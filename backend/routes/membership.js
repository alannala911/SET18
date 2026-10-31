import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readStore, updateStore, uploadDirectory } from "../lib/store.js";
import {
  createToken,
  hashPassword,
  normalizeEmail,
  tokenHash,
  validEmail,
  verifyPassword
} from "../lib/security.js";

const router = express.Router();
const flows = ["regular", "minor", "gift", "craft"];
const memberCookieName = "set18_member_session";
const memberSessionLifetimeMs = 8 * 60 * 60 * 1000;
const minimumPasswordLength = 12;
const failedMemberLogins = new Map();
const dummyPasswordHash = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 60, parts: 70 }
}).array("files", 5);

function getCookie(req, name) {
  const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function safeMember(member) {
  const { passwordHash, ...safe } = member;
  return safe;
}

function memberCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/membership",
    maxAge: memberSessionLifetimeMs
  };
}

export function requireMember(req, res, next) {
  const token = getCookie(req, memberCookieName);
  if (!token) return res.status(401).json({ message: "Member authentication required" });
  const hashed = tokenHash(token);
  const session = readStore().sessions.find((item) =>
    item.kind === "member" && item.tokenHash === hashed && Date.parse(item.expiresAt) > Date.now()
  );
  const member = session && readStore().members.find((item) => item.id === session.memberId && item.status === "active");
  if (!member) return res.status(401).json({ message: "Member authentication required" });
  req.member = member;
  next();
}

function publicConfig(config) {
  return {
    membershipTypes: config.membershipTypes,
    regions: config.regions,
    addressLookupAvailable: false,
    fields: config.fields,
    requiredFields: config.requiredFields,
    options: config.options || {},
    craftShippingInstructions: config.craftShippingInstructions || ""
  };
}

function responseError(res, message, status = 400, fields) {
  return res.status(status).json({ message, ...(fields ? { fields } : {}) });
}

function recordMemberLoginFailure(key) {
  if (!failedMemberLogins.has(key) && failedMemberLogins.size >= 5000) {
    failedMemberLogins.delete(failedMemberLogins.keys().next().value);
  }
  const current = failedMemberLogins.get(key) || { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= 10) current.lockedUntil = Date.now() + 15 * 60 * 1000;
  failedMemberLogins.set(key, current);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeValue(value, depth = 0, root = true) {
  if (depth > 6) throw new Error("Form data is nested too deeply");
  if (typeof value === "string") return value.trim().slice(0, 2000);
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (value.length > 20) throw new Error("Form data contains too many items");
    return value.map((item) => sanitizeValue(item, depth + 1, false));
  }
  if (isRecord(value)) {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(key) ||
          ["__proto__", "prototype", "constructor", "passwordHash", "activationTokenHash", "id", "status", "createdAt"].includes(key) ||
          (!root && key === "password")) {
        continue;
      }
      output[key] = sanitizeValue(item, depth + 1, false);
    }
    return output;
  }
  if (value === null || value === undefined) return "";
  throw new Error("Form data values must be strings, booleans, numbers, arrays, or objects");
}

function fieldValue(values, flow, field) {
  if (field === "files") return values.__fileCount || 0;
  if (flow === "regular" && field.startsWith("person.")) {
    return values.person?.[field.slice("person.".length)] ?? values[field.slice("person.".length)];
  }
  if (flow === "minor" && field.startsWith("parent.")) {
    return values.parents?.[0]?.[field.slice("parent.".length)];
  }
  if (field.startsWith("localGroup.")) {
    return values.localGroup?.[field.slice("localGroup.".length)] ?? values[field.slice("localGroup.".length)];
  }
  return field.split(".").reduce((value, part) => value?.[part], values);
}

function checkRequired(values, flow) {
  const required = readStore().config.requiredFields?.[flow] || [];
  return required
    .filter((field) => field !== "confirmPassword")
    .filter((field) => {
      const value = fieldValue(values, flow, field);
      return typeof value === "string" ? !value.trim() : value === undefined || value === null || value === false;
    });
}

function validateOptions(values, flow) {
  const fields = readStore().config.options?.[flow] || {};
  for (const [field, allowed] of Object.entries(fields)) {
    if (!Array.isArray(allowed)) continue;
    const value = fieldValue(values, flow, field);
    if (value && !allowed.includes(value)) return `${field} must be one of the configured options`;
  }
  return null;
}

function ageOnDate(dateString) {
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateString) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  if (today.getUTCMonth() < date.getUTCMonth() ||
      (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())) age -= 1;
  return age < 0 ? null : age;
}

function validateRegion(group, flow) {
  const regions = readStore().config.regions || [];
  if (!regions.length) return null;
  const groupRequired = (readStore().config.requiredFields?.[flow] || [])
    .some((field) => field === "localGroup.region" || field === "localGroup.chapter");
  if (!group?.region && !group?.chapter && !groupRequired) return null;
  const region = regions.find((item) => item.name === group?.region);
  if (!region) return "Select a configured region";
  if ((groupRequired || group.region || group.chapter) && !region.chapters.includes(group.chapter)) {
    return "Select a configured chapter for this region";
  }
  return null;
}

function groupFrom(values) {
  return {
    region: values.localGroup?.region || values.region || "",
    chapter: values.localGroup?.chapter || values.chapter || ""
  };
}

function personEmail(person, label) {
  const email = normalizeEmail(person?.email);
  return validEmail(email) ? { email } : { error: `${label} must be a valid email address` };
}

function normalizeAddress(value) {
  return {
    street: value?.street || "",
    postalCode: value?.postalCode || "",
    city: value?.city || ""
  };
}

function regularProfile(values) {
  const person = values.person || {
    firstName: values.firstName,
    middleName: values.middleName,
    lastName: values.lastName,
    gender: values.gender,
    email: values.email,
    phone: values.phone
  };
  return {
    birthDate: values.birthDate,
    person: { ...person, email: normalizeEmail(person.email) },
    address: normalizeAddress(values.address),
    localGroup: groupFrom(values)
  };
}

function memberEmail(member) {
  return member.email || member.profile?.person?.email || member.profile?.child?.email ||
    member.profile?.recipient?.email || member.profile?.email || "";
}

function memberPhone(member) {
  return member.phone || member.profile?.person?.phone || member.profile?.child?.phone ||
    member.profile?.recipient?.phone || member.profile?.phone || "";
}

function normalizedPhone(phone) {
  if (typeof phone !== "string" || !/^\+?[0-9().\s-]+$/.test(phone)) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

function validatePhone(phone, label) {
  if (!normalizedPhone(phone)) return `${label} must be a valid phone number`;
  return null;
}

function memberConflict(state, email, phone) {
  const normalized = normalizedPhone(phone);
  return state.members.some((item) =>
    memberEmail(item) === email ||
    (normalized && normalizedPhone(memberPhone(item)) === normalized)
  );
}

function pendingGiftConflict(state, email, phone) {
  const normalized = normalizedPhone(phone);
  return state.applications.some((item) => item.type === "gift" && item.status === "pending_activation" &&
    Date.parse(item.activationExpiresAt) > Date.now() &&
    (item.profile?.recipient?.email === email ||
      (normalized && normalizedPhone(item.profile?.recipient?.phone) === normalized)));
}

router.get("/config", (req, res) => {
  res.json(publicConfig(readStore().config));
});

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email).slice(0, 254);
    const password = req.body?.password;
    const key = `${req.ip}:${email}`;
    const attempts = failedMemberLogins.get(key);
    if (attempts && attempts.count >= 10 && attempts.lockedUntil > Date.now()) {
      return responseError(res, "Too many login attempts; try again later", 429);
    }
    const member = readStore().members.find((item) => memberEmail(item) === email && item.status === "active");
    const passwordIsValid = typeof password === "string" &&
      password.length >= minimumPasswordLength && password.length <= 200;
    const passwordMatches = await verifyPassword(
      typeof password === "string" ? password.slice(0, 200) : "",
      member?.passwordHash || dummyPasswordHash
    );
    if (!(validEmail(email) && passwordIsValid && passwordMatches)) {
      recordMemberLoginFailure(key);
      return responseError(res, "Invalid email or password", 401);
    }
    failedMemberLogins.delete(key);
    const token = createToken();
    const expiresAt = new Date(Date.now() + memberSessionLifetimeMs).toISOString();
    await updateStore((state) => {
      state.sessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > Date.now());
      state.sessions.push({ kind: "member", tokenHash: tokenHash(token), memberId: member.id, expiresAt });
    });
    res.cookie(memberCookieName, token, memberCookieOptions());
    res.json({ message: "Signed in", member: safeMember(member) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireMember, (req, res) => {
  res.json({ authenticated: true, member: safeMember(req.member) });
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = getCookie(req, memberCookieName);
    if (token) {
      const hashed = tokenHash(token);
      await updateStore((state) => {
        state.sessions = state.sessions.filter((session) => session.tokenHash !== hashed);
      });
    }
    res.clearCookie(memberCookieName, { ...memberCookieOptions(), maxAge: undefined });
    res.json({ message: "Signed out" });
  } catch (error) {
    next(error);
  }
});

router.post("/regular", async (req, res, next) => {
  try {
    if (!readStore().config.membershipTypes.regular) return responseError(res, "This membership type is unavailable", 403);
    if (!isRecord(req.body)) return responseError(res, "Request body must be an object");
    const values = sanitizeValue(req.body);
    const missing = checkRequired(values, "regular");
    if (missing.length) return responseError(res, "Required fields are missing", 400, missing);
    const age = ageOnDate(values.birthDate);
    if (age === null || age < 18) return responseError(res, "Regular members must be at least 18; enter a valid birthDate");
    const profile = regularProfile(values);
    const emailResult = personEmail(profile.person, "Email");
    if (emailResult.error) return responseError(res, emailResult.error);
    const phoneError = validatePhone(profile.person.phone, "Phone");
    if (phoneError) return responseError(res, phoneError);
    const optionsError = validateOptions(values, "regular");
    if (optionsError) return responseError(res, optionsError);
    const regionError = validateRegion(profile.localGroup, "regular");
    if (regionError) return responseError(res, regionError);
    if (typeof values.password !== "string" ||
        values.password.length < minimumPasswordLength || values.password.length > 200) {
      return responseError(res, `Password must be between ${minimumPasswordLength} and 200 characters`);
    }
    const member = {
      id: randomUUID(),
      type: "regular",
      status: "active",
      profile,
      passwordHash: await hashPassword(values.password),
      createdAt: new Date().toISOString()
    };
    const exists = await updateStore((state) => {
      if (memberConflict(state, emailResult.email, profile.person.phone) ||
          pendingGiftConflict(state, emailResult.email, profile.person.phone)) return true;
      state.members.push(member);
      return false;
    });
    if (exists) return responseError(res, "The email or phone number is already associated with a member or pending gift", 409);
    res.status(201).json({ message: "Membership registered", id: member.id });
  } catch (error) {
    if (error.message.startsWith("Form data")) return responseError(res, error.message);
    next(error);
  }
});

router.post("/minor", async (req, res, next) => {
  try {
    if (!readStore().config.membershipTypes.minor) return responseError(res, "This membership type is unavailable", 403);
    if (!isRecord(req.body)) return responseError(res, "Request body must be an object");
    const values = sanitizeValue(req.body);
    const missing = checkRequired(values, "minor");
    if (missing.length) return responseError(res, "Required fields are missing", 400, missing);
    if (!Array.isArray(values.parents) || values.parents.length < 1 || values.parents.length > 4) {
      return responseError(res, "At least one parent or guardian is required");
    }
    const age = ageOnDate(values.child?.birthDate);
    if (age === null || age >= 18) return responseError(res, "Minor members must be under 18; enter a valid child.birthDate");
    if (values.consent !== true) return responseError(res, "Guardian consent is required");
    const childEmail = personEmail(values.child, "Child email");
    if (childEmail.error) return responseError(res, childEmail.error);
    const childPhoneError = validatePhone(values.child.phone, "Child phone");
    if (childPhoneError) return responseError(res, childPhoneError);
    const optionsError = validateOptions(values, "minor");
    if (optionsError) return responseError(res, optionsError);
    for (const [index, parent] of values.parents.entries()) {
      if (!parent?.firstName || !parent?.lastName) return responseError(res, `Parent ${index + 1} firstName and lastName are required`);
      const parentEmail = personEmail(parent, `Parent ${index + 1} email`);
      if (parentEmail.error) return responseError(res, parentEmail.error);
      const parentPhoneError = validatePhone(parent.phone, `Parent ${index + 1} phone`);
      if (parentPhoneError) return responseError(res, parentPhoneError);
    }
    const regionError = validateRegion(groupFrom(values), "minor");
    if (regionError) return responseError(res, regionError);
    if (typeof values.password !== "string" ||
        values.password.length < minimumPasswordLength || values.password.length > 200) {
      return responseError(res, `Password must be between ${minimumPasswordLength} and 200 characters`);
    }
    const member = {
      id: randomUUID(),
      type: "minor",
      status: "active",
      profile: {
        child: { ...values.child, email: childEmail.email },
        parents: values.parents.map((parent) => ({ ...parent, email: normalizeEmail(parent.email) })),
        address: normalizeAddress(values.address),
        localGroup: groupFrom(values),
        consent: true
      },
      passwordHash: await hashPassword(values.password),
      createdAt: new Date().toISOString()
    };
    const exists = await updateStore((state) => {
      if (memberConflict(state, childEmail.email, values.child.phone) ||
          pendingGiftConflict(state, childEmail.email, values.child.phone)) return true;
      state.members.push(member);
      return false;
    });
    if (exists) return responseError(res, "The email or phone number is already associated with a member or pending gift", 409);
    res.status(201).json({ message: "Membership registered", id: member.id });
  } catch (error) {
    if (error.message.startsWith("Form data")) return responseError(res, error.message);
    next(error);
  }
});

router.post("/gift", async (req, res, next) => {
  try {
    if (!readStore().config.membershipTypes.gift) return responseError(res, "Gift membership is unavailable", 403);
    if (!isRecord(req.body)) return responseError(res, "Request body must be an object");
    const values = sanitizeValue(req.body);
    const missing = checkRequired(values, "gift");
    if (missing.length) return responseError(res, "Required fields are missing", 400, missing);
    const purchaserAge = ageOnDate(values.purchaser?.birthDate);
    if (purchaserAge === null || purchaserAge < 18) return responseError(res, "Gift purchasers must be at least 18; enter a valid purchaser.birthDate");
    const recipientAge = ageOnDate(values.recipient?.birthDate);
    if (recipientAge === null) return responseError(res, "A valid recipient.birthDate is required");
    let guardian;
    if (recipientAge < 18) {
      if (!isRecord(values.guardian)) return responseError(res, "A guardian is required when the gift recipient is under 18");
      if (!values.guardian.firstName || !values.guardian.lastName || !values.guardian.gender) {
        return responseError(res, "Guardian firstName, lastName, and gender are required");
      }
      if (values.consent !== true) return responseError(res, "Guardian consent is required for a minor gift recipient");
      const guardianEmail = personEmail(values.guardian, "Guardian email");
      if (guardianEmail.error) return responseError(res, guardianEmail.error);
      const guardianPhoneError = validatePhone(values.guardian.phone, "Guardian phone");
      if (guardianPhoneError) return responseError(res, guardianPhoneError);
      guardian = {
        ...values.guardian,
        email: guardianEmail.email
      };
    }
    const purchaserEmail = personEmail(values.purchaser, "Purchaser email");
    if (purchaserEmail.error) return responseError(res, purchaserEmail.error);
    const recipientEmail = personEmail(values.recipient, "Recipient email");
    if (recipientEmail.error) return responseError(res, recipientEmail.error);
    const purchaserPhoneError = validatePhone(values.purchaser.phone, "Purchaser phone");
    if (purchaserPhoneError) return responseError(res, purchaserPhoneError);
    const recipientPhoneError = validatePhone(values.recipient.phone, "Recipient phone");
    if (recipientPhoneError) return responseError(res, recipientPhoneError);
    const group = groupFrom(values);
    const regionError = validateRegion(group, "gift");
    if (regionError) return responseError(res, regionError);
    const optionsError = validateOptions(values, "gift");
    if (optionsError) return responseError(res, optionsError);
    const token = createToken();
    const application = {
      id: randomUUID(),
      type: "gift",
      status: "pending_activation",
      profile: {
        purchaser: { ...values.purchaser, email: purchaserEmail.email, address: normalizeAddress(values.purchaser.address) },
        recipient: { ...values.recipient, email: recipientEmail.email, address: normalizeAddress(values.recipient.address) },
        ...(guardian ? { guardian, consent: true } : {}),
        localGroup: group
      },
      activationTokenHash: tokenHash(token),
      activationExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };
    const saved = await updateStore((state) => {
      if (memberConflict(state, recipientEmail.email, values.recipient.phone) ||
          pendingGiftConflict(state, recipientEmail.email, values.recipient.phone)) return false;
      state.applications.push(application);
      return true;
    });
    if (!saved) return responseError(res, "The recipient email or phone number is already associated with a member or pending gift", 409);
    const frontendBase = (process.env.PUBLIC_FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    res.status(201).json({
      message: "Gift membership recorded; activate it using the recipient link",
      id: application.id,
      activationUrl: `${frontendBase}/medlemskap?aktiver=${encodeURIComponent(token)}`
    });
  } catch (error) {
    if (error.message.startsWith("Form data")) return responseError(res, error.message);
    next(error);
  }
});

router.get("/gift/activate/:token", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || "")) {
    return responseError(res, "Activation link is invalid or expired", 404);
  }
  const application = readStore().applications.find((item) =>
    item.type === "gift" && item.status === "pending_activation" && item.activationTokenHash === tokenHash(token)
  );
  if (!application || Date.parse(application.activationExpiresAt) < Date.now()) {
    return responseError(res, "Activation link is invalid or expired", 404);
  }
  const selected = application.profile.localGroup || {};
  const groupSelected = Boolean(selected.region && selected.chapter);
  res.json({
    groupSelected,
    localGroup: groupSelected ? { region: selected.region, chapter: selected.chapter } : null
  });
});

router.post("/gift/activate/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || "")) return responseError(res, "Activation link is invalid or expired", 400);
    const application = readStore().applications.find((item) =>
      item.type === "gift" && item.status === "pending_activation" && item.activationTokenHash === tokenHash(token)
    );
    if (!application || Date.parse(application.activationExpiresAt) < Date.now()) {
      return responseError(res, "Activation link is invalid or expired", 400);
    }
    const password = req.body?.password;
    if (typeof password !== "string" ||
        password.length < minimumPasswordLength || password.length > 200) {
      return responseError(res, `Password must be between ${minimumPasswordLength} and 200 characters`);
    }
    const values = sanitizeValue(req.body);
    const savedGroup = application.profile.localGroup || {};
    const savedGroupSelected = Boolean(savedGroup.region && savedGroup.chapter);
    const hasConfiguredGroups = (readStore().config.regions || []).length > 0;
    if (!savedGroupSelected && hasConfiguredGroups && (!values.region || !values.chapter)) {
      return responseError(res, "A configured region and chapter are required to activate this gift");
    }
    const group = savedGroupSelected
      ? savedGroup
      : { region: values.region || "", chapter: values.chapter || "" };
    const groupError = validateRegion(group, "gift");
    if (groupError) return responseError(res, groupError);
    const email = application.profile.recipient.email;
    const phone = application.profile.recipient.phone;
    const recipientAge = ageOnDate(application.profile.recipient.birthDate);
    if (recipientAge === null) return responseError(res, "Gift recipient has an invalid birthdate", 400);
    const isMinor = recipientAge < 18;
    if (isMinor && (!application.profile.guardian || application.profile.consent !== true)) {
      return responseError(res, "Gift is missing required guardian consent", 400);
    }
    const phoneError = validatePhone(phone, "Recipient phone");
    if (phoneError) return responseError(res, phoneError);
    const member = {
      id: randomUUID(),
      type: isMinor ? "minor" : "gift",
      status: "active",
      profile: {
        ...(isMinor ? {
          child: application.profile.recipient,
          parents: [application.profile.guardian],
          consent: true
        } : {
          recipient: application.profile.recipient
        }),
        localGroup: group
      },
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString()
    };
    const activated = await updateStore((state) => {
      const stored = state.applications.find((item) => item.id === application.id);
      if (!stored || stored.status !== "pending_activation" ||
          stored.activationTokenHash !== tokenHash(token) || memberConflict(state, email, phone)) {
        return false;
      }
      state.members.push(member);
      stored.status = "activated";
      delete stored.activationTokenHash;
      return true;
    });
    if (!activated) return responseError(res, "Gift activation link has already been used", 409);
    res.status(201).json({ message: "Gift membership activated", id: member.id });
  } catch (error) {
    if (error.message.startsWith("Form data")) return responseError(res, error.message);
    next(error);
  }
});

function validateFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const header = file.buffer.subarray(0, 8);
  if (extension === ".pdf" && header.subarray(0, 5).toString() === "%PDF-") return { mimeType: "application/pdf", extension };
  if (extension === ".png" && header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && header.length === 8) {
    return { mimeType: "image/png", extension };
  }
  if ((extension === ".jpg" || extension === ".jpeg") && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }
  return null;
}

function cleanFileName(name) {
  return path.basename(name).replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 180);
}

router.post("/craft", (req, res, next) => {
  const complete = async () => {
    if (!readStore().config.membershipTypes.craft) return responseError(res, "Craft membership is unavailable", 403);
    let rawApplication = req.body?.application;
    let files = req.files || [];
    if (typeof rawApplication === "string") {
      try {
        rawApplication = JSON.parse(rawApplication);
      } catch {
        return responseError(res, "Multipart application must contain valid JSON");
      }
    } else if (req.is("multipart/form-data")) {
      return responseError(res, "Multipart form must include an application JSON field");
    } else if (!rawApplication) {
      rawApplication = req.body;
    }
    if (!isRecord(rawApplication)) return responseError(res, "Application must be a JSON object");
    const values = sanitizeValue(rawApplication);
    values.__fileCount = files.length;
    const missing = checkRequired(values, "craft");
    if (missing.length) return responseError(res, "Required fields are missing", 400, missing);
    const applicantAge = ageOnDate(values.applicant?.birthDate);
    if (applicantAge === null || applicantAge < 18) return responseError(res, "Craft applicants must be at least 18; enter a valid applicant.birthDate");
    if (values.business?.qualificationConfirmed !== true) {
      return responseError(res, "Business qualification confirmation is required");
    }
    if (values.criteriaAccepted !== true) return responseError(res, "Craft membership criteria must be accepted");
    if (!["certificate", "jury"].includes(values.admissionMethod)) {
      return responseError(res, "admissionMethod must be certificate or jury");
    }
    const businessEmail = personEmail(values.business, "Business email");
    if (businessEmail.error) return responseError(res, businessEmail.error);
    const applicantEmail = personEmail(values.applicant, "Applicant email");
    if (applicantEmail.error) return responseError(res, applicantEmail.error);
    const applicantPhoneError = validatePhone(values.applicant.phone, "Applicant phone");
    if (applicantPhoneError) return responseError(res, applicantPhoneError);
    const regionError = validateRegion(groupFrom(values), "craft");
    if (regionError) return responseError(res, regionError);
    const optionsError = validateOptions(values, "craft");
    if (optionsError) return responseError(res, optionsError);
    const validatedFiles = [];
    for (const file of files) {
      const valid = validateFile(file);
      if (!valid) return responseError(res, "Only valid PDF, PNG, and JPEG files are accepted");
      validatedFiles.push({
        id: randomUUID(),
        originalName: cleanFileName(file.originalname),
        size: file.size,
        mimeType: valid.mimeType,
        extension: valid.extension,
        buffer: file.buffer
      });
    }
    const id = randomUUID();
    const savedFiles = [];
    for (const file of validatedFiles) {
      const fileName = `${id}-${file.id}${file.extension}`;
      const folder = path.join(uploadDirectory, id);
      await mkdir(folder, { recursive: true, mode: 0o700 });
      await writeFile(path.join(folder, fileName), file.buffer, { flag: "wx", mode: 0o600 });
      savedFiles.push({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        storageName: fileName
      });
    }
    delete values.__fileCount;
    const application = {
      id,
      type: "craft",
      status: "pending_review",
      profile: {
        ...values,
        business: { ...values.business, email: businessEmail.email, address: normalizeAddress(values.business.address) },
        applicant: { ...values.applicant, email: applicantEmail.email, address: normalizeAddress(values.applicant.address) },
        localGroup: groupFrom(values)
      },
      files: savedFiles,
      createdAt: new Date().toISOString()
    };
    await updateStore((state) => { state.applications.push(application); });
    res.status(201).json({ message: "Craft application received", id });
  };

  if (!req.is("multipart/form-data")) {
    complete().catch((error) => {
      if (error.message.startsWith("Form data")) return responseError(res, error.message);
      next(error);
    });
    return;
  }
  upload(req, res, (error) => {
    if (error) {
      const messages = {
        LIMIT_FILE_SIZE: "Each file must be 5 MB or smaller",
        LIMIT_FILE_COUNT: "A maximum of 5 files is allowed",
        LIMIT_UNEXPECTED_FILE: "Use the repeated files field for up to 5 attachments"
      };
      return responseError(res, messages[error.code] || "Multipart upload is invalid or exceeds the file limits");
    }
    complete().catch((completeError) => {
      if (completeError.message.startsWith("Form data")) return responseError(res, completeError.message);
      next(completeError);
    });
  });
});

export default router;
