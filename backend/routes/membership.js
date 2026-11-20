// Definerer API-rutene for medlemsregistrering, kontoer og medlemsprofil
import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readStore, saveUpload, updateStore } from "../lib/store.js";
import { frontendLink, mailConfigured, sendLinkMail } from "../lib/mailer.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  createToken,
  hashPassword,
  normalizeEmail,
  tokenHash,
  validEmail,
  verifyPassword,
} from "../lib/security.js";
import {
  adminProfile,
  agreementFieldIds,
  membershipExpired,
  membershipValidUntil,
  renewedValidUntil,
  agreementsFrom,
  isRecord,
  memberEmail,
  termsRequiredMessage,
} from "../lib/members.js";
import {
  FORM_DATA_ERROR_PREFIX,
  ageOnDate,
  checkRequired,
  contactMatches,
  groupFrom,
  memberConflict,
  normalizeAddress,
  normalizedPhone,
  pendingGiftConflict,
  personEmail,
  regularProfile,
  sanitizeValue,
  validateOptions,
  validatePhone,
  validateRegion,
  validDateString,
} from "../lib/membershipValidation.js";

const router = express.Router();
const memberCookieName = "set18_member_session";
const memberSessionLifetimeMs = 8 * 60 * 60 * 1000;
const minimumPasswordLength = 12;
const profileChangeLifetimeMs = 30 * 60 * 1000;
const failedMemberLogins = new Map();
const passwordResetLifetimeMs = 30 * 60 * 1000;
const registrationLimit = rateLimit({
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: "For mange registreringer. Prøv igjen senere.",
});
const passwordLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const dummyPasswordHash = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 60, parts: 70 },
}).array("files", 5);
const customFormUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 100, parts: 110 },
}).any();

function getMemberCookie(req) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${memberCookieName}=`));
  return cookie
    ? decodeURIComponent(cookie.slice(memberCookieName.length + 1))
    : "";
}

function safeMember(member) {
  // Klienter får profil og gyldighet, men aldri passordhash eller interne engangstokenhash
  const {
    passwordHash,
    credentialSetupTokenHash,
    credentialSetupExpiresAt,
    profileChangeTokenHash,
    profileChangeExpiresAt,
    profileChangeRequestedAt,
    passwordResetTokenHash,
    passwordResetExpiresAt,
    ...safe
  } = member;
  return {
    ...safe,
    validUntil: membershipValidUntil(member),
    expired: membershipExpired(member),
  };
}

function memberCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/membership",
    maxAge: memberSessionLifetimeMs,
  };
}

function sendProfileChangeEmail(email, token) {
  return sendLinkMail(email, {
    subject: "Lenke for å endre personopplysninger",
    intro: "Bruk lenken innen 30 minutter for å endre personopplysningene dine",
    linkText: "Endre personopplysninger",
    link: frontendLink(
      `/min-side/endre-personopplysninger?token=${encodeURIComponent(token)}`,
    ),
    outro: "Hvis du ikke ba om denne lenken, kan du se bort fra e-posten.",
  });
}

export function requireMember(req, res, next) {
  const token = getMemberCookie(req);
  if (!token)
    return res.status(401).json({ message: "Medlemsinnlogging kreves" });
  const hashed = tokenHash(token);
  const session = readStore().sessions.find(
    // Hash cookie-tokenet ved søk; session-ID-en alene gir ikke tilgang til medlemskontoen
    (item) =>
      item.kind === "member" &&
      item.tokenHash === hashed &&
      Date.parse(item.expiresAt) > Date.now(),
  );
  const member =
    session &&
    readStore().members.find(
      (item) => item.id === session.memberId && item.status === "active",
    );
  if (!member)
    return res.status(401).json({ message: "Medlemsinnlogging kreves" });
  req.member = member;
  req.sessionTokenHash = hashed;
  next();
}

function publicConfig(config) {
  return {
    membershipTypes: config.membershipTypes,
    regions: config.regions,
    addressLookupAvailable: false,
    fields: config.fields,
    sections: config.sections || {},
    additionalFields: config.additionalFields || {},
    customForms: (config.customForms || []).filter((form) => form.active),
    requiredFields: config.requiredFields,
    options: config.options || {},
    craftShippingInstructions: config.craftShippingInstructions || "",
  };
}

function responseError(res, message, status = 400, fields) {
  return res.status(status).json({ message, ...(fields ? { fields } : {}) });
}

function asyncRoute(handler) {
  return (req, res, next) => handler(req, res).catch(next);
}

function handleSubmissionError(error, res, next) {
  if (
    typeof error?.message === "string" &&
    error.message.startsWith(FORM_DATA_ERROR_PREFIX)
  ) {
    return responseError(res, error.message);
  }
  next(error);
}

function registrationValues(
  res,
  rawValues,
  flow,
  invalidMessage,
  fileCount = 0,
) {
  if (!isRecord(rawValues)) {
    responseError(res, invalidMessage);
    return null;
  }
  const values = sanitizeValue(rawValues);
  if (fileCount) values.__fileCount = fileCount;
  const missing = checkRequired(values, flow);
  if (missing.length) {
    responseError(res, "Obligatoriske felt mangler", 400, missing);
    return null;
  }
  return values;
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

function validActivationIdentifier(identifier) {
  return (
    typeof identifier === "string" &&
    (validEmail(normalizeEmail(identifier)) ||
      Boolean(normalizedPhone(identifier)))
  );
}

function activationIsEligible(record, type) {
  const isPending =
    record.status === "pending_activation" ||
    (type === "minor" && record.status === "active");
  const expiresAt =
    type === "gift"
      ? record.activationExpiresAt
      : record.credentialSetupExpiresAt;
  return (
    record.type === type && isPending && Date.parse(expiresAt) > Date.now()
  );
}

function activationTarget(state, type, token) {
  const isGift = type === "gift";
  const records = isGift ? state.applications : state.members;
  const tokenField = isGift
    ? "activationTokenHash"
    : "credentialSetupTokenHash";
  const digest = tokenHash(token);
  return records.find(
    (item) => activationIsEligible(item, type) && item[tokenField] === digest,
  );
}

function activationContact(record, type) {
  if (type === "gift") {
    return {
      email: record.profile?.recipient?.email,
      phone: record.profile?.recipient?.phone,
    };
  }
  const person =
    type === "minor" ? record.profile?.child : record.profile?.applicant;
  return { email: person?.email, phone: person?.phone };
}

function activationLookupTarget(state, type, identifier) {
  const records = type === "gift" ? state.applications : state.members;
  return records.find((item) => {
    if (
      !activationIsEligible(item, type) ||
      (type !== "gift" && !item.credentialSetupTokenHash)
    )
      return false;
    const contact = activationContact(item, type);
    return contactMatches(identifier, contact.email, contact.phone);
  });
}

function checkActivationRateLimit(req, identifier) {
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedContact = validEmail(normalizedEmail)
    ? normalizedEmail
    : normalizedPhone(identifier) || normalizedEmail;
  const key = `activation:${req.ip}:${normalizedContact}`;
  const attempts = failedMemberLogins.get(key);
  if (attempts && attempts.count >= 10 && attempts.lockedUntil > Date.now())
    return false;
  return key;
}

router.post(
  ["/regular", "/minor", "/gift", "/craft", "/custom/:formId"],
  registrationLimit,
);

router.get("/config", (req, res) => {
  res.json(publicConfig(readStore().config));
});

router.post("/activation/lookup", (req, res) => {
  const { type, identifier } = req.body || {};
  const key = checkActivationRateLimit(req, identifier);
  if (!key)
    return responseError(res, "For mange forsøk. Prøv igjen senere.", 429);
  const validType = ["gift", "minor", "craft"].includes(type);
  const validIdentifier = validActivationIdentifier(identifier);
  if (
    !validType ||
    !validIdentifier ||
    !activationLookupTarget(readStore(), type, identifier)
  ) {
    // Bruk samme svar for ukjent kontakt og ugyldige data for å ikke røpe medlemskap
    recordMemberLoginFailure(key);
    return responseError(
      res,
      "Vi kunne ikke bekrefte kontaktopplysningene. Kontroller dem og prøv igjen.",
      400,
    );
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ found: true });
});

router.post("/activation/verify", (req, res) => {
  const { type, identifier, token } = req.body || {};
  const key = checkActivationRateLimit(req, identifier);
  if (!key)
    return responseError(res, "For mange forsøk. Prøv igjen senere.", 429);
  const validType = ["gift", "minor", "craft"].includes(type);
  const validIdentifier = validActivationIdentifier(identifier);
  const validToken =
    typeof token === "string" && /^[A-Za-z0-9_-]{30,60}$/.test(token);
  const target =
    validType && validIdentifier && validToken
      ? activationTarget(readStore(), type, token)
      : null;
  const contact = target && activationContact(target, type);
  if (!target || !contactMatches(identifier, contact.email, contact.phone)) {
    recordMemberLoginFailure(key);
    return responseError(
      res,
      "Aktiveringskoden eller kontaktopplysningene er ugyldige eller utløpt.",
      400,
    );
  }
  // Slå opp token og kontaktopplysning sammen, slik at en gyldig lenke alene ikke aktiverer feil konto
  failedMemberLogins.delete(key);
  res.setHeader("Cache-Control", "no-store");
  if (type === "gift") {
    const localGroup = target.profile.localGroup || {};
    const groupSelected = Boolean(localGroup.region && localGroup.chapter);
    return res.json({
      verified: true,
      groupSelected,
      localGroup: groupSelected ? localGroup : null,
    });
  }
  res.json({ verified: true });
});

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email).slice(0, 254);
    const password = req.body?.password;
    const key = `${req.ip}:${email}`;
    const attempts = failedMemberLogins.get(key);
    if (attempts && attempts.count >= 10 && attempts.lockedUntil > Date.now()) {
      return responseError(
        res,
        "For mange innloggingsforsøk. Prøv igjen senere.",
        429,
      );
    }
    const state = readStore();
    const member = state.members.find(
      (item) => memberEmail(item) === email && item.status === "active",
    );
    const passwordIsValid =
      typeof password === "string" &&
      password.length >= minimumPasswordLength &&
      password.length <= 200;
    const passwordMatches = await verifyPassword(
      // Samme passordhash-operasjon også når konto mangler reduserer forskjeller i svartid
      typeof password === "string" ? password.slice(0, 200) : "",
      member?.passwordHash || dummyPasswordHash,
    );
    if (!(validEmail(email) && passwordIsValid && passwordMatches)) {
      recordMemberLoginFailure(key);
      return responseError(res, "Ugyldig e-postadresse eller passord", 401);
    }
    failedMemberLogins.delete(key);
    const token = createToken();
    const expiresAt = new Date(
      Date.now() + memberSessionLifetimeMs,
    ).toISOString();
    await updateStore((state) => {
      state.sessions = state.sessions.filter(
        (session) => Date.parse(session.expiresAt) > Date.now(),
      );
      state.sessions.push({
        kind: "member",
        tokenHash: tokenHash(token),
        memberId: member.id,
        expiresAt,
      });
    });
    res.cookie(memberCookieName, token, memberCookieOptions());
    res.json({
      message: "Logget inn",
      member: safeMember(member),
      hasAdminAccess: state.admins.some(
        (admin) => admin.memberId === member.id,
      ),
    });
  }),
);

router.get("/me", requireMember, (req, res) => {
  res.json({ authenticated: true, member: safeMember(req.member) });
});

const passwordLengthError = (password) =>
  typeof password === "string" &&
  password.length >= minimumPasswordLength &&
  password.length <= 200
    ? ""
    : `Passordet må være mellom ${minimumPasswordLength} og 200 tegn`;

const findAccountByEmail = (state, email) =>
  state.admins.find((admin) => admin.email === email && admin.passwordHash) ||
  state.members.find(
    (member) => memberEmail(member) === email && member.status === "active",
  );

const sessionOwnedBy = (account) => {
  const email = account.email || memberEmail(account);
  return (session) =>
    session.kind === "admin"
      ? session.email === email
      : session.memberId === account.id;
};

router.post(
  "/password/forgot",
  passwordLimit,
  asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body?.email).slice(0, 254);
    const reply = {
      message:
        "Hvis e-postadressen er registrert, har vi sendt en lenke for å velge nytt passord.",
    };
    if (!validEmail(email)) return res.json(reply);
    if (!mailConfigured())
      return responseError(
        res,
        "E-postutsending er ikke konfigurert. Kontakt administrator.",
        503,
      );
    const token = createToken();
    const found = await updateStore((state) => {
      const account = findAccountByEmail(state, email);
      if (!account) return false;
      account.passwordResetTokenHash = tokenHash(token);
      account.passwordResetExpiresAt = new Date(
        Date.now() + passwordResetLifetimeMs,
      ).toISOString();
      return true;
    });
    if (found) {
      await sendLinkMail(email, {
        subject: "Velg nytt passord",
        intro: "Bruk lenken innen 30 minutter for å velge nytt passord",
        linkText: "Velg nytt passord",
        link: frontendLink(
          `/min-side/nytt-passord?token=${encodeURIComponent(token)}`,
        ),
        outro: "Hvis du ikke ba om dette, kan du se bort fra e-posten.",
      }).catch((mailError) =>
        console.error(
          "Kunne ikke sende e-post for nytt passord:",
          mailError.message,
        ),
      );
    }
    res.json(reply);
  }),
);

router.post(
  "/password/reset",
  passwordLimit,
  asyncRoute(async (req, res) => {
    const { token, password } = req.body || {};
    const lengthError = passwordLengthError(password);
    if (lengthError) return responseError(res, lengthError);
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{30,60}$/.test(token)) {
      return responseError(res, "Lenken er ugyldig eller utløpt.");
    }
    const hashedToken = tokenHash(token);
    const passwordHash = await hashPassword(password);
    const reset = await updateStore((state) => {
      const account = [...state.admins, ...state.members].find(
        (item) =>
          item.passwordResetTokenHash === hashedToken &&
          Date.parse(item.passwordResetExpiresAt) > Date.now(),
      );
      if (!account) return false;
      account.passwordHash = passwordHash;
      delete account.passwordResetTokenHash;
      delete account.passwordResetExpiresAt;
      state.sessions = state.sessions.filter(
        (session) => !sessionOwnedBy(account)(session),
      );
      return true;
    });
    if (!reset) return responseError(res, "Lenken er ugyldig eller utløpt.");
    res.json({ message: "Passordet er endret. Du kan nå logge inn." });
  }),
);

export async function changePassword(req, res, findAccount) {
  const { currentPassword, newPassword } = req.body || {};
  const lengthError = passwordLengthError(newPassword);
  if (lengthError) return responseError(res, lengthError);
  const current = findAccount(readStore());
  const matches =
    typeof currentPassword === "string" &&
    (await verifyPassword(
      currentPassword.slice(0, 200),
      current?.passwordHash || dummyPasswordHash,
    ));
  if (!current || !matches)
    return responseError(res, "Nåværende passord er feil", 401);
  const passwordHash = await hashPassword(newPassword);
  await updateStore((state) => {
    const account = findAccount(state);
    account.passwordHash = passwordHash;
    // Behold gjeldende økt, men krev ny innlogging i alle andre kontoøkter etter passordbytte
    state.sessions = state.sessions.filter(
      (session) =>
        !sessionOwnedBy(account)(session) ||
        session.tokenHash === req.sessionTokenHash,
    );
  });
  res.json({ message: "Passordet er endret" });
}

router.post(
  "/me/password",
  passwordLimit,
  requireMember,
  asyncRoute((req, res) =>
    changePassword(req, res, (state) =>
      state.members.find((item) => item.id === req.member.id),
    ),
  ),
);

router.delete(
  "/me",
  passwordLimit,
  requireMember,
  asyncRoute(async (req, res) => {
    const { password } = req.body || {};
    const matches =
      typeof password === "string" &&
      (await verifyPassword(
        password.slice(0, 200),
        req.member.passwordHash || dummyPasswordHash,
      ));
    if (!matches) return responseError(res, "Passordet er feil", 401);
    await updateStore((state) => {
      state.members = state.members.filter((item) => item.id !== req.member.id);
      state.sessions = state.sessions.filter(
        (session) => session.memberId !== req.member.id,
      );
      state.orders
        .filter(
          (order) =>
            order.memberId === req.member.id && order.status === "confirmed",
        )
        .forEach((order) => {
          order.status = "cancelled";
          order.cancelledAt = new Date().toISOString();
        });
    });
    res.clearCookie(memberCookieName, {
      ...memberCookieOptions(),
      maxAge: undefined,
    });
    res.json({ message: "Medlemskapet er slettet" });
  }),
);

router.post(
  "/me/renew",
  requireMember,
  asyncRoute(async (req, res) => {
    const member = await updateStore((state) => {
      const stored = state.members.find((item) => item.id === req.member.id);
      stored.validUntil = renewedValidUntil(stored);
      stored.renewedAt = new Date().toISOString();
      return stored;
    });
    res.json({
      message: "Medlemskapet er fornyet",
      member: safeMember(member),
    });
  }),
);

router.patch(
  "/me/consents",
  requireMember,
  asyncRoute(async (req, res) => {
    const { emailOffers, smsOffers } = req.body || {};
    if (typeof emailOffers !== "boolean" || typeof smsOffers !== "boolean") {
      return responseError(
        res,
        "emailOffers og smsOffers må være sant eller usant",
      );
    }
    const member = await updateStore((state) => {
      const stored = state.members.find((item) => item.id === req.member.id);
      Object.assign(stored.profile, { emailOffers, smsOffers });
      return stored;
    });
    res.json({ message: "Samtykkene er lagret", member: safeMember(member) });
  }),
);

export async function sendProfileChangeLink(res, email, findOwner) {
  if (!validEmail(normalizeEmail(email))) {
    return responseError(
      res,
      "En gyldig e-postadresse kreves for å sende endringslenken",
      400,
    );
  }
  if (!mailConfigured()) {
    return responseError(
      res,
      "E-postutsending er ikke konfigurert. Kontakt administrator.",
      503,
    );
  }
  const token = createToken();
  const hashedToken = tokenHash(token);
  const expiresAt = new Date(
    Date.now() + profileChangeLifetimeMs,
  ).toISOString();
  const requestStatus = await updateStore((state) => {
    const owner = findOwner(state);
    if (!owner) return "missing";
    if (
      owner.profileChangeRequestedAt &&
      Date.now() - Date.parse(owner.profileChangeRequestedAt) < 60_000
    )
      return "rate-limited";
    owner.profileChangeTokenHash = hashedToken;
    owner.profileChangeExpiresAt = expiresAt;
    owner.profileChangeRequestedAt = new Date().toISOString();
    return "saved";
  });
  if (requestStatus === "missing")
    return responseError(res, "Kontoen ble ikke funnet.", 404);
  if (requestStatus === "rate-limited")
    return responseError(
      res,
      "Vent ett minutt før du ber om en ny lenke.",
      429,
    );

  try {
    await sendProfileChangeEmail(email, token);
  } catch (mailError) {
    console.error("Could not send profile-change email:", mailError.message);
    await updateStore((state) => {
      const owner = findOwner(state);
      if (owner?.profileChangeTokenHash === hashedToken) {
        delete owner.profileChangeTokenHash;
        delete owner.profileChangeExpiresAt;
        delete owner.profileChangeRequestedAt;
      }
    });
    return responseError(
      res,
      "Kunne ikke sende e-post. Kontroller e-postinnstillingene eller prøv igjen senere.",
      502,
    );
  }
  res.json({
    message:
      "En lenke for å endre personopplysninger er sendt til e-postadressen din.",
  });
}

router.post(
  "/profile/change-request",
  requireMember,
  asyncRoute((req, res) =>
    sendProfileChangeLink(res, memberEmail(req.member), (state) =>
      state.members.find((item) => item.id === req.member.id),
    ),
  ),
);

const liveProfileChange = (owner, hashedToken) =>
  owner?.profileChangeTokenHash === hashedToken &&
  Date.parse(owner.profileChangeExpiresAt) > Date.now();

router.get(
  "/profile/change/:token",
  asyncRoute(async (req, res) => {
    const { token } = req.params;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || "")) {
      return responseError(res, "Lenken er ugyldig eller utløpt.", 400);
    }
    const hashedToken = tokenHash(token);
    const { members, admins } = readStore();
    const adminAccount = admins.find((admin) =>
      liveProfileChange(admin, hashedToken),
    );
    const isAdmin = Boolean(adminAccount);
    const member = members.find(
      (item) =>
        liveProfileChange(item, hashedToken) && item.status === "active",
    );
    if (!isAdmin && !member)
      return responseError(res, "Lenken er ugyldig eller utløpt.", 400);
    res.setHeader("Cache-Control", "no-store");
    const { localGroup, ...editableProfile } = isAdmin
      ? adminProfile(adminAccount)
      : member.profile;
    res.json({
      type: isAdmin ? "admin" : member.type,
      profile: editableProfile,
    });
  }),
);

router.put(
  "/profile/change/:token",
  asyncRoute((req, res) => saveMemberProfileChange(req, res)),
);

const profileChangeFields = {
  regular: {
    contact: "person",
    required: [
      "birthDate",
      "person.firstName",
      "person.lastName",
      "person.gender",
      "address.street",
      "address.postalCode",
      "address.city",
    ],
  },
  minor: {
    contact: "child",
    required: [
      "child.firstName",
      "child.lastName",
      "child.gender",
      "child.birthDate",
      "address.street",
      "address.postalCode",
      "address.city",
    ],
  },
  craft: {
    contact: "applicant",
    required: [
      "applicant.firstName",
      "applicant.lastName",
      "applicant.gender",
      "applicant.birthDate",
      "applicant.address.street",
      "applicant.address.postalCode",
      "applicant.address.city",
      "business.name",
      "business.organizationNumber",
      "business.address.street",
      "business.address.postalCode",
      "business.address.city",
      "business.phone",
      "business.email",
    ],
  },
  gift: {
    contact: "recipient",
    required: [
      "recipient.firstName",
      "recipient.lastName",
      "recipient.gender",
      "recipient.birthDate",
      "recipient.address.street",
      "recipient.address.postalCode",
      "recipient.address.city",
    ],
  },
};

function firstMissingPath(profile, paths) {
  return paths.find((fieldPath) => {
    const value = fieldPath
      .split(".")
      .reduce((current, key) => current?.[key], profile);
    return typeof value !== "string" || !value.trim();
  });
}

function saveAdminProfile(state, admin, cleanProfile) {
  const missingPath = firstMissingPath(cleanProfile, [
    "person.firstName",
    "person.lastName",
    "person.gender",
    "address.street",
    "address.postalCode",
    "address.city",
  ]);
  if (missingPath)
    return { error: `${missingPath} må fylles inn.`, status: 400 };
  const email = personEmail(cleanProfile.person, "E-post");
  const error =
    email.error ||
    validatePhone(cleanProfile.person.phone, "Telefonnummer") ||
    validateOptions(cleanProfile, "regular");
  if (error) return { error, status: 400 };
  if (memberConflict(state, email.email, cleanProfile.person.phone)) {
    return {
      error:
        "E-postadressen eller telefonnummeret er allerede registrert på et medlemskap.",
      status: 409,
    };
  }
  admin.profile = {
    person: { ...cleanProfile.person, email: email.email },
    address: cleanProfile.address,
    localGroup: admin.profile?.localGroup,
  };
  delete admin.profileChangeTokenHash;
  delete admin.profileChangeExpiresAt;
  return { profile: adminProfile(admin) };
}

async function saveMemberProfileChange(req, res) {
  const { token } = req.params;
  if (
    !/^[A-Za-z0-9_-]{30,60}$/.test(token || "") ||
    !isRecord(req.body?.profile)
  ) {
    return responseError(res, "Lenken eller opplysningene er ugyldige.", 400);
  }
  const hashedToken = tokenHash(token);
  let cleanProfile;
  try {
    cleanProfile = sanitizeValue(req.body.profile);
  } catch (error) {
    if (error.message.startsWith(FORM_DATA_ERROR_PREFIX))
      return responseError(res, error.message);
    throw error;
  }
  if (!isRecord(cleanProfile))
    return responseError(res, "Opplysningene må være et objekt.");

  const result = await updateStore((state) => {
    const admin = state.admins.find((item) =>
      liveProfileChange(item, hashedToken),
    );
    if (admin) return saveAdminProfile(state, admin, cleanProfile);
    const member = state.members.find(
      (item) =>
        liveProfileChange(item, hashedToken) && item.status === "active",
    );
    if (!member)
      return { error: "Lenken er ugyldig eller utløpt.", status: 400 };
    const localGroup = member.profile?.localGroup;
    delete cleanProfile.localGroup;

    const profileFields =
      profileChangeFields[member.type] || profileChangeFields.gift;
    const contact = cleanProfile[profileFields.contact];
    const missingPath = firstMissingPath(cleanProfile, profileFields.required);
    if (missingPath)
      return { error: `${missingPath} må fylles inn.`, status: 400 };
    const contactEmail = personEmail(contact, "E-post");
    if (contactEmail.error) return { error: contactEmail.error, status: 400 };
    const phoneError = validatePhone(contact?.phone, "Telefonnummer");
    if (phoneError) return { error: phoneError, status: 400 };
    const optionsError = validateOptions(cleanProfile, member.type);
    if (optionsError) return { error: optionsError, status: 400 };
    if (
      memberConflict(state, contactEmail.email, contact.phone, member.id) ||
      pendingGiftConflict(state, contactEmail.email, contact.phone)
    ) {
      return {
        error:
          "E-postadressen eller telefonnummeret er allerede registrert på et annet medlemskap.",
        status: 409,
      };
    }

    if (member.type === "regular") {
      const age = ageOnDate(cleanProfile.birthDate);
      if (age === null || age < 18 || age > 120)
        return {
          error: "Fødselsdatoen må vise at medlemmet er mellom 18 og 120 år.",
          status: 400,
        };
    }
    if (member.type === "minor") {
      const age = ageOnDate(contact?.birthDate);
      if (age === null || age >= 18)
        return {
          error: "Barnets fødselsdato må vise at medlemmet er under 18 år.",
          status: 400,
        };
      if (
        !Array.isArray(cleanProfile.parents) ||
        cleanProfile.parents.length < 1
      ) {
        return { error: "Minst én foresatt må være registrert.", status: 400 };
      }
      for (const [index, parent] of cleanProfile.parents.entries()) {
        if (!parent?.firstName?.trim() || !parent?.lastName?.trim()) {
          return {
            error: `Foresatt ${index + 1} må ha fornavn og etternavn.`,
            status: 400,
          };
        }
        const parentEmail = personEmail(
          parent,
          `Foresatt ${index + 1} sin e-post`,
        );
        const parentPhoneError = validatePhone(
          parent?.phone,
          `Foresatt ${index + 1} sitt telefonnummer`,
        );
        if (parentEmail.error) return { error: parentEmail.error, status: 400 };
        if (parentPhoneError) return { error: parentPhoneError, status: 400 };
        const allowedGenders =
          readStore().config.options?.minor?.["parent.gender"];
        if (
          Array.isArray(allowedGenders) &&
          !allowedGenders.includes(parent.gender)
        ) {
          return {
            error: `Foresatt ${index + 1} må ha et gyldig kjønn.`,
            status: 400,
          };
        }
      }
      if (cleanProfile.consent !== true)
        return {
          error: "Samtykke fra foresatt må være bekreftet.",
          status: 400,
        };
    }
    if (member.type === "gift") {
      const age = ageOnDate(contact?.birthDate);
      if (age === null || age < 18 || age > 120)
        return {
          error:
            "Fødselsdatoen til mottakeren må vise en alder mellom 18 og 120 år.",
          status: 400,
        };
    }
    if (member.type === "craft") {
      const businessEmail = personEmail(
        cleanProfile.business,
        "Bedriftens e-post",
      );
      const businessPhoneError = validatePhone(
        cleanProfile.business?.phone,
        "Bedriftens telefonnummer",
      );
      if (businessEmail.error)
        return { error: businessEmail.error, status: 400 };
      if (businessPhoneError) return { error: businessPhoneError, status: 400 };
      cleanProfile.business.email = businessEmail.email;
    }

    contact.email = contactEmail.email;
    if (Object.hasOwn(member, "email")) member.email = contactEmail.email;
    if (Object.hasOwn(member, "phone")) member.phone = contact.phone;
    cleanProfile.localGroup = localGroup;
    member.profile = cleanProfile;
    delete member.profileChangeTokenHash;
    delete member.profileChangeExpiresAt;
    return { member: safeMember(member) };
  });
  if (result.error) return responseError(res, result.error, result.status);
  res.json({ message: "Personopplysningene er oppdatert.", ...result });
}

router.patch(
  "/me/local-group",
  requireMember,
  asyncRoute((req, res) =>
    saveLocalGroup(
      req,
      res,
      (state) => state.members.find((item) => item.id === req.member.id),
      (member) => ({ member: safeMember(member) }),
    ),
  ),
);

export async function saveLocalGroup(req, res, findOwner, publicOwner) {
  const region =
    typeof req.body?.region === "string" ? req.body.region.trim() : "";
  const chapter =
    typeof req.body?.chapter === "string" ? req.body.chapter.trim() : "";
  if (!region || !chapter)
    return responseError(res, "Velg både region og lokallag.");
  const regionAvailable = (readStore().config.regions || []).some(
    (item) => item.name === region && item.chapters.includes(chapter),
  );
  if (!regionAvailable)
    return responseError(
      res,
      "Velg en tilgjengelig region og et lokallag i regionen.",
    );
  const owner = await updateStore((state) => {
    const currentOwner = findOwner(state);
    if (!currentOwner) return null;
    currentOwner.profile = {
      ...currentOwner.profile,
      localGroup: { region, chapter },
    };
    return publicOwner(currentOwner);
  });
  if (!owner) return responseError(res, "Kontoen ble ikke funnet.", 404);
  res.json({ message: "Lokallaget er oppdatert.", ...owner });
}

router.post(
  "/logout",
  asyncRoute(async (req, res) => {
    const token = getMemberCookie(req);
    if (token) {
      const hashed = tokenHash(token);
      await updateStore((state) => {
        state.sessions = state.sessions.filter(
          (session) => session.tokenHash !== hashed,
        );
      });
    }
    res.clearCookie(memberCookieName, {
      ...memberCookieOptions(),
      maxAge: undefined,
    });
    res.json({ message: "Logget ut" });
  }),
);

router.post(
  "/craft/activate/:token",
  asyncRoute(async (req, res) => {
    const token = req.params.token;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || "")) {
      return responseError(
        res,
        "Aktiveringslenken er ugyldig eller utløpt",
        400,
      );
    }
    const identifier =
      typeof req.body?.identifier === "string"
        ? req.body.identifier.trim()
        : "";
    const key = checkActivationRateLimit(req, identifier);
    if (!key)
      return responseError(res, "For mange forsøk. Prøv igjen senere.", 429);
    if (!validActivationIdentifier(identifier)) {
      return responseError(
        res,
        "Oppgi en gyldig e-postadresse eller et gyldig telefonnummer",
      );
    }
    const password = req.body?.password;
    if (
      typeof password !== "string" ||
      password.length < minimumPasswordLength ||
      password.length > 200
    ) {
      return responseError(
        res,
        `Passordet må være mellom ${minimumPasswordLength} og 200 tegn`,
      );
    }
    const member = activationTarget(readStore(), "craft", token);
    const contact = member && activationContact(member, "craft");
    if (!member || !contactMatches(identifier, contact.email, contact.phone)) {
      recordMemberLoginFailure(key);
      return responseError(
        res,
        "Aktiveringslenken er ugyldig, utløpt eller allerede brukt",
        400,
      );
    }
    const passwordHash = await hashPassword(password);
    const activated = await updateStore((state) => {
      const current = activationTarget(state, "craft", token);
      const currentContact = current && activationContact(current, "craft");
      if (
        !current ||
        !contactMatches(identifier, currentContact.email, currentContact.phone)
      )
        return false;
      current.passwordHash = passwordHash;
      current.status = "active";
      delete current.credentialSetupTokenHash;
      delete current.credentialSetupExpiresAt;
      return true;
    });
    if (!activated) {
      recordMemberLoginFailure(key);
      return responseError(
        res,
        "Aktiveringslenken er ugyldig, utløpt eller allerede brukt",
        409,
      );
    }
    failedMemberLogins.delete(key);
    res.json({ message: "Håndverksmedlemskapet er aktivert" });
  }),
);

router.post("/regular", async (req, res, next) => {
  try {
    if (!readStore().config.membershipTypes.regular)
      return responseError(
        res,
        "Denne medlemskapstypen er ikke tilgjengelig",
        403,
      );
    const values = registrationValues(
      res,
      req.body,
      "regular",
      "Forespørselen må være et objekt",
    );
    if (!values) return;
    const age = ageOnDate(values.birthDate);
    if (age === null || age < 18)
      return responseError(
        res,
        "Ordinære medlemmer må være minst 18 år. Oppgi en gyldig birthDate",
      );
    if (values.termsAccepted !== true)
      return responseError(res, termsRequiredMessage);
    const profile = { ...regularProfile(values), ...agreementsFrom(values) };
    const emailResult = personEmail(profile.person, "E-postadresse");
    if (emailResult.error) return responseError(res, emailResult.error);
    const phoneError = validatePhone(profile.person.phone, "Telefonnummer");
    if (phoneError) return responseError(res, phoneError);
    const optionsError = validateOptions(values, "regular");
    if (optionsError) return responseError(res, optionsError);
    const regionError = validateRegion(profile.localGroup, "regular");
    if (regionError) return responseError(res, regionError);
    if (
      typeof values.password !== "string" ||
      values.password.length < minimumPasswordLength ||
      values.password.length > 200
    ) {
      return responseError(
        res,
        `Passordet må være mellom ${minimumPasswordLength} og 200 tegn`,
      );
    }
    const member = {
      id: randomUUID(),
      type: "regular",
      status: "active",
      profile,
      passwordHash: await hashPassword(values.password),
      createdAt: new Date().toISOString(),
    };
    const exists = await updateStore((state) => {
      // Kontroller konflikt og opprettelse i samme oppdatering for å unngå doble kontoer
      if (
        memberConflict(state, emailResult.email, profile.person.phone) ||
        pendingGiftConflict(state, emailResult.email, profile.person.phone)
      )
        return true;
      state.members.push(member);
      return false;
    });
    if (exists)
      return responseError(
        res,
        "E-postadressen eller telefonnummeret er allerede knyttet til et medlemskap eller en ventende gaveregistrering",
        409,
      );
    res
      .status(201)
      .json({ message: "Medlemskapet er registrert", id: member.id });
  } catch (error) {
    handleSubmissionError(error, res, next);
  }
});

router.post("/minor", async (req, res, next) => {
  try {
    if (!readStore().config.membershipTypes.minor)
      return responseError(
        res,
        "Denne medlemskapstypen er ikke tilgjengelig",
        403,
      );
    const values = registrationValues(
      res,
      req.body,
      "minor",
      "Forespørselen må være et objekt",
    );
    if (!values) return;
    if (
      !Array.isArray(values.parents) ||
      values.parents.length < 1 ||
      values.parents.length > 4
    ) {
      return responseError(res, "Minst én forelder eller foresatt er påkrevd");
    }
    const age = ageOnDate(values.child?.birthDate);
    if (age === null || age >= 18)
      return responseError(
        res,
        "Mindreårige medlemmer må være under 18 år. Oppgi en gyldig child.birthDate",
      );
    if (values.consent !== true)
      return responseError(res, "Samtykke fra foresatt er påkrevd");
    if (values.termsAccepted !== true)
      return responseError(res, termsRequiredMessage);
    const childEmail = personEmail(values.child, "Barnets e-postadresse");
    if (childEmail.error) return responseError(res, childEmail.error);
    const childPhoneError = validatePhone(
      values.child?.phone,
      "Barnets telefonnummer",
    );
    if (childPhoneError) return responseError(res, childPhoneError);
    const optionsError = validateOptions(values, "minor");
    if (optionsError) return responseError(res, optionsError);
    for (const [index, parent] of values.parents.entries()) {
      if (!parent?.firstName || !parent?.lastName)
        return responseError(
          res,
          `Foresatt ${index + 1} må ha fornavn og etternavn`,
        );
      const parentEmail = personEmail(
        parent,
        `E-postadressen til foresatt ${index + 1}`,
      );
      if (parentEmail.error) return responseError(res, parentEmail.error);
      const parentPhoneError = validatePhone(
        parent.phone,
        `Telefonnummeret til foresatt ${index + 1}`,
      );
      if (parentPhoneError) return responseError(res, parentPhoneError);
    }
    const regionError = validateRegion(groupFrom(values), "minor");
    if (regionError) return responseError(res, regionError);
    const credentialSetupToken = createToken();
    // Mindreårige får først en konto som venter på aktivering/passordoppsett
    // Mindreårige får først status etter foresattes bekreftelse og passordoppsett
    const member = {
      id: randomUUID(),
      type: "minor",
      status: "pending_activation",
      profile: {
        child: {
          ...values.child,
          email: childEmail.email,
          phone: values.child.phone,
        },
        parents: values.parents.map((parent) => ({
          ...parent,
          email: normalizeEmail(parent.email),
        })),
        address: normalizeAddress(values.address),
        localGroup: groupFrom(values),
        consent: true,
        ...agreementsFrom(values),
      },
      credentialSetupTokenHash: tokenHash(credentialSetupToken),
      credentialSetupExpiresAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: new Date().toISOString(),
    };
    const exists = await updateStore((state) => {
      // Konfliktsjekk og opprettelse gjøres samlet for å unngå doble medlemskontoer
      if (
        memberConflict(state, childEmail.email, values.child?.phone) ||
        pendingGiftConflict(state, childEmail.email, values.child.phone)
      )
        return true;
      state.members.push(member);
      return false;
    });
    if (exists)
      return responseError(
        res,
        "E-postadressen eller telefonnummeret er allerede knyttet til et medlemskap eller en ventende gaveregistrering",
        409,
      );
    const frontendBase = (
      process.env.PUBLIC_FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");
    res.status(201).json({
      message: "Medlemskapet er registrert",
      id: member.id,
      activationUrl: `${frontendBase}/medlemskap?aktiver-mindreaarig=${encodeURIComponent(credentialSetupToken)}`,
    });
  } catch (error) {
    handleSubmissionError(error, res, next);
  }
});

router.post(
  "/minor/activate/:token",
  asyncRoute(async (req, res) => {
    const token = req.params.token;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || "")) {
      return responseError(
        res,
        "Aktiveringslenken er ugyldig eller utløpt",
        400,
      );
    }
    const identifier =
      typeof req.body?.identifier === "string"
        ? req.body.identifier.trim()
        : "";
    const password = req.body?.password;
    const key = checkActivationRateLimit(req, identifier);
    if (!key)
      return responseError(res, "For mange forsøk. Prøv igjen senere.", 429);
    if (!validActivationIdentifier(identifier)) {
      return responseError(
        res,
        "Oppgi en gyldig e-postadresse eller et gyldig telefonnummer",
      );
    }
    if (
      typeof password !== "string" ||
      password.length < minimumPasswordLength ||
      password.length > 200
    ) {
      return responseError(
        res,
        `Passordet må være mellom ${minimumPasswordLength} og 200 tegn`,
      );
    }
    const member = activationTarget(readStore(), "minor", token);
    const contact = member && activationContact(member, "minor");
    if (!member || !contactMatches(identifier, contact.email, contact.phone)) {
      recordMemberLoginFailure(key);
      return responseError(
        res,
        "Aktiveringslenken er ugyldig, utløpt eller allerede brukt",
        400,
      );
    }
    const passwordHash = await hashPassword(password);
    const activated = await updateStore((state) => {
      const current = activationTarget(state, "minor", token);
      const currentContact = current && activationContact(current, "minor");
      if (
        !current ||
        !contactMatches(identifier, currentContact.email, currentContact.phone)
      )
        return false;
      current.passwordHash = passwordHash;
      current.status = "active";
      delete current.credentialSetupTokenHash;
      delete current.credentialSetupExpiresAt;
      return true;
    });
    if (!activated) {
      recordMemberLoginFailure(key);
      return responseError(
        res,
        "Aktiveringslenken er ugyldig, utløpt eller allerede brukt, eller kontaktopplysningene stemmer ikke",
        409,
      );
    }
    failedMemberLogins.delete(key);
    res.json({
      message: "Innlogging for medlemskap for mindreårig er aktivert",
    });
  }),
);

router.post("/gift", async (req, res, next) => {
  try {
    if (!readStore().config.membershipTypes.gift)
      return responseError(res, "Gavemedlemskap er ikke tilgjengelig", 403);
    const values = registrationValues(
      res,
      req.body,
      "gift",
      "Forespørselen må være et objekt",
    );
    if (!values) return;
    if (values.termsAccepted !== true)
      return responseError(res, termsRequiredMessage);
    const purchaserAge = ageOnDate(values.purchaser?.birthDate);
    if (purchaserAge === null || purchaserAge < 18)
      return responseError(
        res,
        "Gavekjøperen må være minst 18 år. Oppgi en gyldig purchaser.birthDate",
      );
    const recipientAge = ageOnDate(values.recipient?.birthDate);
    if (recipientAge === null)
      return responseError(res, "En gyldig recipient.birthDate er påkrevd");
    let guardian;
    if (recipientAge < 18) {
      if (!isRecord(values.guardian))
        return responseError(
          res,
          "En foresatt er påkrevd når gavemottakeren er under 18 år",
        );
      if (
        !values.guardian.firstName ||
        !values.guardian.lastName ||
        !values.guardian.gender
      ) {
        return responseError(
          res,
          "Foresattens fornavn, etternavn og kjønn er påkrevd",
        );
      }
      if (values.consent !== true)
        return responseError(
          res,
          "Samtykke fra foresatt er påkrevd når gavemottakeren er mindreårig",
        );
      const guardianEmail = personEmail(values.guardian, "Guardian email");
      if (guardianEmail.error) return responseError(res, guardianEmail.error);
      const guardianPhoneError = validatePhone(
        values.guardian.phone,
        "Guardian phone",
      );
      if (guardianPhoneError) return responseError(res, guardianPhoneError);
      guardian = {
        ...values.guardian,
        email: guardianEmail.email,
      };
    }
    const purchaserEmail = personEmail(values.purchaser, "Purchaser email");
    if (purchaserEmail.error) return responseError(res, purchaserEmail.error);
    const recipientEmail = personEmail(values.recipient, "Recipient email");
    if (recipientEmail.error) return responseError(res, recipientEmail.error);
    const purchaserPhoneError = validatePhone(
      values.purchaser.phone,
      "Purchaser phone",
    );
    if (purchaserPhoneError) return responseError(res, purchaserPhoneError);
    const recipientPhoneError = validatePhone(
      values.recipient.phone,
      "Recipient phone",
    );
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
        purchaser: {
          ...values.purchaser,
          email: purchaserEmail.email,
          address: normalizeAddress(values.purchaser.address),
        },
        recipient: {
          ...values.recipient,
          email: recipientEmail.email,
          address: normalizeAddress(values.recipient.address),
        },
        ...(guardian ? { guardian, consent: true } : {}),
        localGroup: group,
        ...agreementsFrom(values),
      },
      activationTokenHash: tokenHash(token),
      activationExpiresAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: new Date().toISOString(),
    };
    const saved = await updateStore((state) => {
      if (
        memberConflict(state, recipientEmail.email, values.recipient.phone) ||
        pendingGiftConflict(state, recipientEmail.email, values.recipient.phone)
      )
        return false;
      state.applications.push(application);
      return true;
    });
    if (!saved)
      return responseError(
        res,
        "Gavemottakerens e-postadresse eller telefonnummer er allerede knyttet til et medlemskap eller en ventende gaveregistrering",
        409,
      );
    const frontendBase = (
      process.env.PUBLIC_FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");
    res.status(201).json({
      message:
        "Gavemedlemskapet er registrert. Aktiver det med lenken som er sendt til mottakeren",
      id: application.id,
      activationUrl: `${frontendBase}/medlemskap?aktiver=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    handleSubmissionError(error, res, next);
  }
});

router.get("/gift/activate/:token", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || "")) {
    return responseError(res, "Aktiveringslenken er ugyldig eller utløpt", 404);
  }
  const application = readStore().applications.find(
    (item) =>
      item.type === "gift" &&
      item.status === "pending_activation" &&
      item.activationTokenHash === tokenHash(token),
  );
  if (
    !application ||
    Date.parse(application.activationExpiresAt) < Date.now()
  ) {
    return responseError(res, "Aktiveringslenken er ugyldig eller utløpt", 404);
  }
  const selected = application.profile.localGroup || {};
  const groupSelected = Boolean(selected.region && selected.chapter);
  res.json({
    groupSelected,
    localGroup: groupSelected
      ? { region: selected.region, chapter: selected.chapter }
      : null,
  });
});

router.post("/gift/activate/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token || ""))
      return responseError(
        res,
        "Aktiveringslenken er ugyldig eller utløpt",
        400,
      );
    const identifier =
      typeof req.body?.identifier === "string"
        ? req.body.identifier.trim()
        : "";
    const key = checkActivationRateLimit(req, identifier);
    if (!key)
      return responseError(res, "For mange forsøk. Prøv igjen senere.", 429);
    if (!validActivationIdentifier(identifier)) {
      return responseError(
        res,
        "Oppgi en gyldig e-postadresse eller et gyldig telefonnummer",
      );
    }
    const application = readStore().applications.find(
      (item) =>
        item.type === "gift" &&
        item.status === "pending_activation" &&
        item.activationTokenHash === tokenHash(token),
    );
    if (
      !application ||
      Date.parse(application.activationExpiresAt) < Date.now() ||
      !contactMatches(
        identifier,
        application.profile?.recipient?.email,
        application.profile?.recipient?.phone,
      )
    ) {
      recordMemberLoginFailure(key);
      return responseError(
        res,
        "Aktiveringslenken er ugyldig eller utløpt",
        400,
      );
    }
    const password = req.body?.password;
    if (
      typeof password !== "string" ||
      password.length < minimumPasswordLength ||
      password.length > 200
    ) {
      return responseError(
        res,
        `Passordet må være mellom ${minimumPasswordLength} og 200 tegn`,
      );
    }
    const values = sanitizeValue(req.body);
    const savedGroup = application.profile.localGroup || {};
    const savedGroupSelected = Boolean(savedGroup.region && savedGroup.chapter);
    const hasConfiguredGroups = (readStore().config.regions || []).length > 0;
    if (
      !savedGroupSelected &&
      hasConfiguredGroups &&
      (!values.region || !values.chapter)
    ) {
      return responseError(
        res,
        "Velg en tilgjengelig region og et lokallag for å aktivere gavemedlemskapet",
      );
    }
    const group = savedGroupSelected
      ? savedGroup
      : { region: values.region || "", chapter: values.chapter || "" };
    const groupError = validateRegion(group, "gift");
    if (groupError) return responseError(res, groupError);
    const email = application.profile.recipient.email;
    const phone = application.profile.recipient.phone;
    const recipientAge = ageOnDate(application.profile.recipient.birthDate);
    if (recipientAge === null)
      return responseError(res, "Gavemottakerens fødselsdato er ugyldig", 400);
    const isMinor = recipientAge < 18;
    if (
      isMinor &&
      (!application.profile.guardian || application.profile.consent !== true)
    ) {
      return responseError(
        res,
        "Nødvendig samtykke fra foresatt mangler for gavemedlemskapet",
        400,
      );
    }
    const phoneError = validatePhone(phone, "Recipient phone");
    if (phoneError) return responseError(res, phoneError);
    const member = {
      id: randomUUID(),
      type: isMinor ? "minor" : "gift",
      status: "active",
      profile: {
        ...(isMinor
          ? {
              child: application.profile.recipient,
              parents: [application.profile.guardian],
              consent: true,
            }
          : {
              recipient: application.profile.recipient,
            }),
        localGroup: group,
        ...agreementsFrom(application.profile),
      },
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    const activated = await updateStore((state) => {
      const stored = state.applications.find(
        (item) => item.id === application.id,
      );
      if (
        !stored ||
        stored.status !== "pending_activation" ||
        stored.activationTokenHash !== tokenHash(token) ||
        !contactMatches(
          identifier,
          stored.profile?.recipient?.email,
          stored.profile?.recipient?.phone,
        ) ||
        memberConflict(state, email, phone)
      ) {
        return false;
      }
      state.members.push(member);
      stored.status = "activated";
      delete stored.activationTokenHash;
      return true;
    });
    if (!activated) {
      recordMemberLoginFailure(key);
      return responseError(
        res,
        "Aktiveringslenken for gavemedlemskapet er allerede brukt",
        409,
      );
    }
    failedMemberLogins.delete(key);
    res
      .status(201)
      .json({ message: "Gavemedlemskapet er aktivert", id: member.id });
  } catch (error) {
    handleSubmissionError(error, res, next);
  }
});

function validateFile(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const header = file.buffer.subarray(0, 8);
  // Kontroller filsignatur i tillegg til filendelse; klientens MIME-type kan ikke stoles på
  if (extension === ".pdf" && header.subarray(0, 5).toString() === "%PDF-")
    return { mimeType: "application/pdf", extension };
  if (
    extension === ".png" &&
    header.equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ) &&
    header.length === 8
  ) {
    return { mimeType: "image/png", extension };
  }
  if (
    (extension === ".jpg" || extension === ".jpeg") &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }
  return null;
}

function cleanFileName(name) {
  return path
    .basename(name)
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .slice(0, 180);
}

router.post("/craft", (req, res, next) => {
  const complete = async () => {
    if (!readStore().config.membershipTypes.craft)
      return responseError(
        res,
        "Håndverksmedlemskap er ikke tilgjengelig",
        403,
      );
    let rawApplication = req.body?.application;
    let files = req.files || [];
    if (typeof rawApplication === "string") {
      try {
        rawApplication = JSON.parse(rawApplication);
      } catch {
        return responseError(res, "Søknaden må inneholde gyldig JSON");
      }
    } else if (req.is("multipart/form-data")) {
      return responseError(
        res,
        "Skjemaet må inneholde et application-felt med JSON",
      );
    } else if (!rawApplication) {
      rawApplication = req.body;
    }
    const values = registrationValues(
      res,
      rawApplication,
      "craft",
      "Søknaden må være et JSON-objekt",
      files.length,
    );
    if (!values) return;
    const applicantAge = ageOnDate(values.applicant?.birthDate);
    if (applicantAge === null || applicantAge < 18)
      return responseError(
        res,
        "Søkere om håndverksmedlemskap må være minst 18 år. Oppgi en gyldig applicant.birthDate",
      );
    if (values.business?.qualificationConfirmed !== true) {
      return responseError(res, "Bekreftelse på yrkeskvalifikasjon er påkrevd");
    }
    if (values.criteriaAccepted !== true)
      return responseError(res, "Kriteriene for håndverksmedlemskap må godtas");
    if (values.termsAccepted !== true)
      return responseError(res, termsRequiredMessage);
    if (!["certificate", "jury"].includes(values.admissionMethod)) {
      return responseError(
        res,
        "admissionMethod må være certificate eller jury",
      );
    }
    const businessEmail = personEmail(values.business, "Business email");
    if (businessEmail.error) return responseError(res, businessEmail.error);
    const applicantEmail = personEmail(values.applicant, "Applicant email");
    if (applicantEmail.error) return responseError(res, applicantEmail.error);
    const applicantPhoneError = validatePhone(
      values.applicant.phone,
      "Applicant phone",
    );
    if (applicantPhoneError) return responseError(res, applicantPhoneError);
    const regionError = validateRegion(groupFrom(values), "craft");
    if (regionError) return responseError(res, regionError);
    const optionsError = validateOptions(values, "craft");
    if (optionsError) return responseError(res, optionsError);
    const validatedFiles = [];
    for (const file of files) {
      const valid = validateFile(file);
      if (!valid)
        return responseError(
          res,
          "Bare gyldige PDF-, PNG- og JPEG-filer godtas",
        );
      validatedFiles.push({
        id: randomUUID(),
        originalName: cleanFileName(file.originalname),
        size: file.size,
        mimeType: valid.mimeType,
        extension: valid.extension,
        buffer: file.buffer,
      });
    }
    const id = randomUUID();
    const savedFiles = [];
    for (const file of validatedFiles) {
      const fileName = `${id}-${file.id}${file.extension}`;
      await saveUpload(path.join(id, fileName), file.buffer, file.mimeType);
      savedFiles.push({
        id: file.id,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        storageName: fileName,
      });
    }
    delete values.__fileCount;
    const application = {
      id,
      type: "craft",
      status: "pending_review",
      profile: {
        ...values,
        business: {
          ...values.business,
          email: businessEmail.email,
          address: normalizeAddress(values.business.address),
        },
        applicant: {
          ...values.applicant,
          email: applicantEmail.email,
          address: normalizeAddress(values.applicant.address),
        },
        localGroup: groupFrom(values),
        ...agreementsFrom(values),
      },
      files: savedFiles,
      createdAt: new Date().toISOString(),
    };
    await updateStore((state) => {
      state.applications.push(application);
    });
    res
      .status(201)
      .json({ message: "Søknad om håndverksmedlemskap er mottatt", id });
  };

  if (!req.is("multipart/form-data")) {
    complete().catch((error) => {
      handleSubmissionError(error, res, next);
    });
    return;
  }
  upload(req, res, (error) => {
    if (error) {
      const messages = {
        LIMIT_FILE_SIZE: "Hver fil kan være på maksimalt 5 MB",
        LIMIT_FILE_COUNT: "Du kan legge ved maksimalt 5 filer",
        LIMIT_UNEXPECTED_FILE:
          "Bruk files-feltet flere ganger for å legge ved opptil 5 filer",
      };
      return responseError(
        res,
        messages[error.code] ||
          "Filopplastingen er ugyldig eller overskrider filgrensene",
      );
    }
    complete().catch((completeError) =>
      handleSubmissionError(completeError, res, next),
    );
  });
});

router.post("/custom/:formId", (req, res, next) => {
  const complete = async () => {
    const form = (readStore().config.customForms || []).find(
      (item) => item.id === req.params.formId && item.active,
    );
    if (!form)
      return responseError(res, "Dette skjemaet er ikke tilgjengelig", 404);
    let rawValues = req.body?.application;
    if (typeof rawValues === "string") {
      try {
        rawValues = JSON.parse(rawValues);
      } catch {
        return responseError(
          res,
          "Skjemainnsendingen må inneholde gyldig JSON",
        );
      }
    } else if (req.is("multipart/form-data")) {
      return responseError(
        res,
        "Skjemaet må inneholde et application-felt med JSON",
      );
    } else {
      rawValues = req.body;
    }
    if (!isRecord(rawValues))
      return responseError(res, "Skjemainnsendingen må være et JSON-objekt");
    const values = sanitizeValue(rawValues);
    const includeAgreements = form.includeAgreements !== false;
    const allowedFields = new Set(
      form.fields
        .filter((field) => !["section", "file"].includes(field.type))
        .map((field) => field.id),
    );
    if (includeAgreements)
      agreementFieldIds.forEach((fieldId) => allowedFields.add(fieldId));
    const unexpectedFields = Object.keys(values).filter(
      (field) => !allowedFields.has(field),
    );
    if (unexpectedFields.length) {
      return responseError(
        res,
        "Skjemainnsendingen inneholder felt som ikke er konfigurert",
        400,
        unexpectedFields,
      );
    }
    if (includeAgreements && values.termsAccepted !== true)
      return responseError(res, termsRequiredMessage);
    const files = req.files || [];
    const fileFields = form.fields.filter((field) => field.type === "file");
    const fileCounts = new Map(fileFields.map((field) => [field.id, 0]));
    for (const file of files) {
      const fieldId = file.fieldname.startsWith("file_")
        ? file.fieldname.slice(5)
        : "";
      if (!fileCounts.has(fieldId))
        return responseError(
          res,
          "Den opplastede filen samsvarer ikke med et skjemafelt",
        );
      fileCounts.set(fieldId, fileCounts.get(fieldId) + 1);
    }
    for (const field of form.fields) {
      if (field.type === "section") continue;
      const value = values[field.id];
      if (field.type === "file") {
        if (field.required && !fileCounts.get(field.id)) {
          return responseError(res, "Obligatoriske felt mangler", 400, [
            field.id,
          ]);
        }
        continue;
      }
      if (
        value !== undefined &&
        ["text", "textarea", "email", "phone", "date", "select"].includes(
          field.type,
        ) &&
        typeof value !== "string"
      ) {
        return responseError(res, `${field.label} må være tekst`);
      }
      if (
        field.required &&
        ((typeof value !== "string" && typeof value !== "boolean") ||
          value === "" ||
          value === false)
      ) {
        return responseError(res, "Obligatoriske felt mangler", 400, [
          field.id,
        ]);
      }
      if (
        field.type === "checkbox" &&
        value !== undefined &&
        typeof value !== "boolean"
      ) {
        return responseError(res, `${field.label} må være en avkrysningsverdi`);
      }
      if (
        field.type === "email" &&
        value &&
        !validEmail(normalizeEmail(value))
      ) {
        return responseError(
          res,
          `${field.label} må være en gyldig e-postadresse`,
        );
      }
      if (field.type === "phone" && value && !normalizedPhone(value)) {
        return responseError(
          res,
          `${field.label} må være et gyldig telefonnummer`,
        );
      }
      if (field.type === "select" && value && !field.options.includes(value)) {
        return responseError(
          res,
          `${field.label} må være et av de konfigurerte alternativene`,
        );
      }
      if (field.type === "date" && value && !validDateString(value)) {
        return responseError(res, `${field.label} må være en gyldig dato`);
      }
    }
    if (files.length && !fileFields.length)
      return responseError(res, "Dette skjemaet godtar ikke filer");
    const validatedFiles = [];
    for (const file of files) {
      const valid = validateFile(file);
      if (!valid)
        return responseError(
          res,
          "Bare gyldige PDF-, PNG- og JPEG-filer godtas",
        );
      validatedFiles.push({
        id: randomUUID(),
        fieldId: file.fieldname.slice(5),
        originalName: cleanFileName(file.originalname),
        size: file.size,
        mimeType: valid.mimeType,
        extension: valid.extension,
        buffer: file.buffer,
      });
    }
    const id = randomUUID();
    const savedFiles = [];
    for (const file of validatedFiles) {
      const fileName = `${id}-${file.id}${file.extension}`;
      await saveUpload(path.join(id, fileName), file.buffer, file.mimeType);
      savedFiles.push({
        id: file.id,
        fieldId: file.fieldId,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType,
        storageName: fileName,
      });
    }
    const application = {
      id,
      type: "custom",
      formId: form.id,
      formName: form.name,
      status: "pending_review",
      profile: values,
      files: savedFiles,
      createdAt: new Date().toISOString(),
    };
    await updateStore((state) => {
      state.applications.push(application);
    });
    res.status(201).json({ message: "Skjemainnsendingen er mottatt", id });
  };
  if (!req.is("multipart/form-data")) {
    complete().catch((error) => {
      handleSubmissionError(error, res, next);
    });
    return;
  }
  customFormUpload(req, res, (error) => {
    if (error) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Hver fil kan være på maksimalt 5 MB"
          : error.code === "LIMIT_FILE_COUNT"
            ? "Du kan legge ved maksimalt 10 filer"
            : "Filopplastingen er ugyldig eller overskrider filgrensene";
      return responseError(res, message);
    }
    complete().catch((completeError) =>
      handleSubmissionError(completeError, res, next),
    );
  });
});

export default router;
