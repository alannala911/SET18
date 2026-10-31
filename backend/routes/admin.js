import express from "express";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream";
import path from "node:path";
import { readStore, updateStore, uploadDirectory } from "../lib/store.js";
import { createToken, normalizeEmail, tokenHash } from "../lib/security.js";
import { requireAdmin } from "./auth.js";

const router = express.Router();
const formTypes = ["regular", "minor", "gift", "craft"];

function memberEmail(member) {
  return normalizeEmail(
    member.email ||
    member.profile?.person?.email ||
    member.profile?.child?.email ||
    member.profile?.recipient?.email ||
    member.profile?.applicant?.email ||
    member.profile?.email
  );
}

function normalizedPhone(phone) {
  return typeof phone === "string" ? phone.replace(/\D/g, "") : "";
}

function memberPhone(member) {
  return member.phone ||
    member.profile?.person?.phone ||
    member.profile?.child?.phone ||
    member.profile?.recipient?.phone ||
    member.profile?.applicant?.phone ||
    member.profile?.phone ||
    "";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validStringArray(value, maxLength = 100) {
  return Array.isArray(value) && value.length <= maxLength &&
    value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 100);
}

function validFieldName(field) {
  return typeof field === "string" && /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){0,4}$/.test(field) && field.length <= 150;
}

function sanitizeRegions(value) {
  if (!Array.isArray(value) || value.length > 200) return { error: "regions must be an array of at most 200 entries" };
  const regions = [];
  for (const region of value) {
    if (!isRecord(region) || typeof region.name !== "string" || !region.name.trim() ||
        region.name.length > 100 || !validStringArray(region.chapters, 200)) {
      return { error: "Each region needs a name and a chapters array" };
    }
    regions.push({ name: region.name.trim(), chapters: region.chapters.map((chapter) => chapter.trim()) });
  }
  if (new Set(regions.map((region) => region.name)).size !== regions.length) {
    return { error: "Region names must be unique" };
  }
  return { value: regions };
}

function sanitizeFields(existing, input) {
  if (!isRecord(input)) return { error: "fields must be an object" };
  const result = structuredClone(existing);
  for (const flow of Object.keys(input)) {
    if (!formTypes.includes(flow) || !isRecord(input[flow])) return { error: `fields.${flow} must be an object` };
    for (const [field, metadata] of Object.entries(input[flow])) {
      if (!validFieldName(field) || !isRecord(metadata)) return { error: `fields.${flow}.${field} is invalid` };
      const current = result[flow]?.[field] || { visible: true, required: false };
      const visible = metadata.visible === undefined ? current.visible : metadata.visible;
      const required = metadata.required === undefined ? current.required : metadata.required;
      if (typeof visible !== "boolean" || typeof required !== "boolean") {
        return { error: `fields.${flow}.${field} needs boolean visible and required values` };
      }
      if (required && !visible) return { error: `Required field ${field} must be visible` };
      let label = current.label;
      if (Object.hasOwn(metadata, "label")) {
        if (typeof metadata.label !== "string" || metadata.label.length > 100) {
          return { error: `fields.${flow}.${field}.label must be a string up to 100 characters` };
        }
        label = metadata.label.trim();
        if (!label) label = undefined;
      }
      result[flow] ??= {};
      result[flow][field] = {
        visible,
        required,
        ...(label ? { label } : {})
      };
    }
  }
  if (Object.values(result).some((fields) => Object.keys(fields).length > 150)) {
    return { error: "A maximum of 150 configurable fields is allowed per flow" };
  }
  return { value: result };
}

function sanitizeOptions(existing, input) {
  if (!isRecord(input)) return { error: "options must be an object" };
  const result = structuredClone(existing || {});
  for (const flow of Object.keys(input)) {
    if (!formTypes.includes(flow) || !isRecord(input[flow])) return { error: `options.${flow} must be an object` };
    result[flow] ??= {};
    for (const [field, values] of Object.entries(input[flow])) {
      if (!validFieldName(field) || !validStringArray(values, 100)) {
        return { error: `options.${flow}.${field} must be an array of up to 100 non-empty strings` };
      }
      const cleanValues = values.map((value) => value.trim());
      if (new Set(cleanValues).size !== cleanValues.length) return { error: `options.${flow}.${field} must not contain duplicates` };
      result[flow][field] = cleanValues;
    }
  }
  if (Object.values(result).some((options) => Object.keys(options).length > 150)) {
    return { error: "A maximum of 150 option lists is allowed per flow" };
  }
  return { value: result };
}

const fieldTypes = new Set(["text", "textarea", "email", "phone", "date", "select", "checkbox", "file", "section"]);

function sanitizeFormFields(input, label) {
  if (!Array.isArray(input) || input.length > 100) return { error: `${label} must contain at most 100 fields` };
  const ids = new Set();
  const fields = [];
  for (const field of input) {
    if (!isRecord(field) || typeof field.id !== "string" ||
        !/^[a-z][a-z0-9_]{1,49}$/.test(field.id) || ids.has(field.id) ||
        !fieldTypes.has(field.type) || typeof field.label !== "string" ||
        !field.label.trim() || field.label.length > 120 ||
        typeof field.required !== "boolean") {
      return { error: `${label} contains an invalid field` };
    }
    ids.add(field.id);
    const clean = {
      id: field.id,
      type: field.type,
      label: field.label.trim(),
      required: field.type === "section" ? false : field.required
    };
    if (field.type === "select") {
      if (!validStringArray(field.options, 100)) return { error: `${label}.${field.id} needs select options` };
      clean.options = field.options.map((option) => option.trim());
      if (new Set(clean.options).size !== clean.options.length) {
        return { error: `${label}.${field.id} options must be unique` };
      }
    }
    if (field.type === "section") {
      if (typeof field.content !== "string" || field.content.length > 2000) {
        return { error: `${label}.${field.id} needs section content up to 2000 characters` };
      }
      clean.content = field.content.trim();
    }
    fields.push(clean);
  }
  return { value: fields };
}

function sanitizeAdditionalFields(existing, input) {
  if (!isRecord(input)) return { error: "additionalFields must be an object" };
  const result = { ...existing };
  for (const [flow, fields] of Object.entries(input)) {
    if (!formTypes.includes(flow)) return { error: `additionalFields.${flow} is invalid` };
    const sanitized = sanitizeFormFields(fields, `additionalFields.${flow}`);
    if (sanitized.error) return sanitized;
    if (sanitized.value.some((field) => field.type === "file")) {
      return { error: "File uploads are only supported on fully custom forms and the craft preset" };
    }
    result[flow] = sanitized.value;
  }
  for (const flow of formTypes) result[flow] ??= [];
  return { value: result };
}

function sanitizeSections(existing, input) {
  if (!isRecord(input)) return { error: "sections must be an object" };
  const result = structuredClone(existing || {});
  for (const [flow, sections] of Object.entries(input)) {
    if (!formTypes.includes(flow) || !isRecord(sections)) return { error: `sections.${flow} must be an object` };
    result[flow] ??= {};
    for (const [key, section] of Object.entries(sections)) {
      if (!key.trim() || key.length > 120 || ["__proto__", "prototype", "constructor"].includes(key) ||
          !isRecord(section)) return { error: `sections.${flow}.${key} is invalid` };
      const current = result[flow][key] || {};
      const next = { ...current };
      if (section.label !== undefined) {
        if (typeof section.label !== "string" || section.label.length > 120) {
          return { error: `sections.${flow}.${key}.label must be up to 120 characters` };
        }
        next.label = section.label.trim();
      }
      if (section.description !== undefined) {
        if (typeof section.description !== "string" || section.description.length > 2000) {
          return { error: `sections.${flow}.${key}.description must be up to 2000 characters` };
        }
        next.description = section.description.trim();
      }
      result[flow][key] = next;
    }
  }
  for (const flow of formTypes) result[flow] ??= {};
  return { value: result };
}

function sanitizeCustomForms(input) {
  if (!Array.isArray(input) || input.length > 25) return { error: "customForms must be an array of at most 25 forms" };
  const forms = [];
  const ids = new Set();
  for (const form of input) {
    if (!isRecord(form) || typeof form.id !== "string" ||
        !/^custom_[a-z0-9_]{3,48}$/.test(form.id) || ids.has(form.id) ||
        typeof form.name !== "string" || !form.name.trim() || form.name.length > 100 ||
        typeof form.description !== "string" || form.description.length > 1000 ||
        typeof form.active !== "boolean") {
      return { error: "customForms contains an invalid form" };
    }
    const sanitized = sanitizeFormFields(form.fields, `customForms.${form.id}.fields`);
    if (sanitized.error) return sanitized;
    if (form.active && !sanitized.value.some((field) => field.type !== "section")) {
      return { error: `${form.name} needs at least one input field before it can be activated` };
    }
    ids.add(form.id);
    forms.push({
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim(),
      active: form.active,
      fields: sanitized.value
    });
  }
  return { value: forms };
}

function buildConfig(existing, input) {
  if (!isRecord(input)) return { error: "Configuration must be an object" };
  const membershipTypes = { ...existing.membershipTypes };
  if (input.membershipTypes !== undefined) {
    if (!isRecord(input.membershipTypes)) return { error: "membershipTypes must be an object" };
    for (const [key, value] of Object.entries(input.membershipTypes)) {
      if (!formTypes.includes(key) || typeof value !== "boolean") return { error: `membershipTypes.${key} must be a boolean` };
      membershipTypes[key] = value;
    }
  }
  for (const flow of formTypes) {
    if (typeof membershipTypes[flow] !== "boolean") return { error: `membershipTypes.${flow} must be a boolean` };
  }

  const regionsResult = input.regions === undefined
    ? { value: existing.regions }
    : sanitizeRegions(input.regions);
  if (regionsResult.error) return regionsResult;
  const fieldsResult = input.fields === undefined
    ? { value: structuredClone(existing.fields) }
    : sanitizeFields(existing.fields, input.fields);
  if (fieldsResult.error) return fieldsResult;
  const optionsResult = input.options === undefined
    ? { value: structuredClone(existing.options || {}) }
    : sanitizeOptions(existing.options || {}, input.options);
  if (optionsResult.error) return optionsResult;
  const additionalFieldsResult = input.additionalFields === undefined
    ? { value: structuredClone(existing.additionalFields || { regular: [], minor: [], gift: [], craft: [] }) }
    : sanitizeAdditionalFields(existing.additionalFields || {}, input.additionalFields);
  if (additionalFieldsResult.error) return additionalFieldsResult;
  const sectionsResult = input.sections === undefined
    ? { value: structuredClone(existing.sections || { regular: {}, minor: {}, gift: {}, craft: {} }) }
    : sanitizeSections(existing.sections || {}, input.sections);
  if (sectionsResult.error) return sectionsResult;
  const customFormsResult = input.customForms === undefined
    ? { value: structuredClone(existing.customForms || []) }
    : sanitizeCustomForms(input.customForms);
  if (customFormsResult.error) return customFormsResult;
  for (const field of ["child.email", "child.phone"]) {
    fieldsResult.value.minor[field] = {
      ...fieldsResult.value.minor[field],
      visible: true,
      required: true
    };
  }
  delete fieldsResult.value.minor.password;
  delete fieldsResult.value.minor.confirmPassword;
  if (input.craftShippingInstructions !== undefined &&
      (typeof input.craftShippingInstructions !== "string" || input.craftShippingInstructions.length > 5000)) {
    return { error: "craftShippingInstructions must be a string of at most 5000 characters" };
  }

  const requiredFields = Object.fromEntries(formTypes.map((flow) => [
    flow,
    Object.entries(fieldsResult.value[flow] || {})
      .filter(([field, metadata]) =>
        metadata.required && !(flow === "minor" && field === "password"))
      .map(([field]) => field)
  ]));
  requiredFields.minor = [...new Set([
    ...requiredFields.minor,
    "child.email",
    "child.phone"
  ])];
  return {
    value: {
      schemaVersion: 4,
      membershipTypes,
      regions: regionsResult.value,
      addressLookupAvailable: false,
      fields: fieldsResult.value,
      sections: sectionsResult.value,
      additionalFields: additionalFieldsResult.value,
      customForms: customFormsResult.value,
      requiredFields,
      options: optionsResult.value,
      craftShippingInstructions: input.craftShippingInstructions === undefined
        ? existing.craftShippingInstructions || ""
        : input.craftShippingInstructions.trim()
    }
  };
}

router.use(requireAdmin);

router.get("/config", (req, res) => {
  const { config } = readStore();
  res.json({
    membershipTypes: config.membershipTypes,
    regions: config.regions,
    addressLookupAvailable: false,
    fields: config.fields,
    sections: config.sections || {},
    additionalFields: config.additionalFields || {},
    customForms: config.customForms || [],
    requiredFields: config.requiredFields,
    options: config.options || {},
    craftShippingInstructions: config.craftShippingInstructions || ""
  });
});

router.put("/config", async (req, res, next) => {
  try {
    const result = buildConfig(readStore().config, req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    await updateStore((state) => { state.config = result.value; });
    res.json({ message: "Configuration updated" });
  } catch (error) {
    next(error);
  }
});

function publicApplication(application) {
  const { activationTokenHash, ...safe } = application;
  return {
    ...safe,
    files: (application.files || []).map(({ id, originalName, size, mimeType }) => ({ id, originalName, size, mimeType }))
  };
}

router.get("/applications", (req, res) => {
  res.json({ applications: readStore().applications.map(publicApplication) });
});

router.patch("/applications/:id", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!["pending_review", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be pending_review, approved, or rejected" });
    }
    const application = readStore().applications.find((item) => item.id === req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (!["craft", "custom"].includes(application.type)) {
      return res.status(400).json({ message: "Only craft and custom form applications can be reviewed" });
    }
    if (application.type === "craft" && status === "approved" && !application.profile?.applicant?.email) {
      return res.status(400).json({ message: "Craft application is missing the applicant's email address" });
    }
    const setupToken = application.type === "craft" && status === "approved" ? createToken() : "";
    const setupTokenHash = setupToken ? tokenHash(setupToken) : "";
    const setupExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = await updateStore((state) => {
      const stored = state.applications.find((item) => item.id === req.params.id);
      if (!stored) return { error: "Application not found" };
      stored.status = status;
      stored.reviewedAt = new Date().toISOString();
      stored.reviewedBy = req.admin.email;
      if (typeof req.body.note === "string") stored.reviewNote = req.body.note.trim().slice(0, 2000);
      if (stored.type !== "craft" || status !== "approved") {
        return { message: "Application review updated" };
      }

      const applicant = stored.profile?.applicant;
      if (!applicant?.email) {
        return { error: "Craft application is missing the applicant's email address" };
      }
      let member = stored.memberId && state.members.find((item) => item.id === stored.memberId);
      if (!member) {
        const applicantEmail = normalizeEmail(applicant.email);
        const applicantPhone = normalizedPhone(applicant.phone);
        member = state.members.find((item) =>
          memberEmail(item) === applicantEmail ||
          (applicantPhone && normalizedPhone(memberPhone(item)) === applicantPhone)
        );
        if (member) {
          stored.memberId = member.id;
          return {
            message: "Application approved. The applicant already has a member account; no new setup link was created."
          };
        }

        member = {
          id: randomUUID(),
          type: "craft",
          status: "pending_activation",
          profile: {
            applicant,
            business: stored.profile.business || {},
            localGroup: stored.profile.localGroup || { region: "", chapter: "" }
          },
          createdAt: new Date().toISOString()
        };
        state.members.push(member);
        stored.memberId = member.id;
      }
      if (member.status === "active") {
        return { message: "Application approved. The member account is already active." };
      }
      member.credentialSetupTokenHash = setupTokenHash;
      member.credentialSetupExpiresAt = setupExpiresAt;
      const frontendBase = (process.env.PUBLIC_FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
      return {
        message: "Application approved. Share the password setup link privately with the applicant.",
        activationUrl: `${frontendBase}/medlemskap?aktiver-haandverker=${encodeURIComponent(setupToken)}`
      };
    });
    if (result.error) {
      return res.status(result.error === "Application not found" ? 404 : 400)
        .json({ message: result.error });
    }
    res.json({ ...result, id: application.id });
  } catch (error) {
    next(error);
  }
});

router.get("/applications/:id/files/:fileId", (req, res, next) => {
  const application = readStore().applications.find((item) => item.id === req.params.id);
  const file = application?.files?.find((item) => item.id === req.params.fileId);
  if (!file) return res.status(404).json({ message: "File not found" });
  const filename = path.join(uploadDirectory, application.id, file.storageName);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(file.originalName).replace(/["\\\r\n]/g, "_")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  pipeline(createReadStream(filename), res, (error) => {
    if (error && !res.headersSent) next(error);
    else if (error) res.destroy(error);
  });
});

export default router;
