import express from "express";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream";
import path from "node:path";
import { readStore, updateStore, uploadDirectory } from "../lib/store.js";
import { requireAdmin } from "./auth.js";

const router = express.Router();
const formTypes = ["regular", "minor", "gift", "craft"];

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
  if (input.craftShippingInstructions !== undefined &&
      (typeof input.craftShippingInstructions !== "string" || input.craftShippingInstructions.length > 5000)) {
    return { error: "craftShippingInstructions must be a string of at most 5000 characters" };
  }

  const requiredFields = Object.fromEntries(formTypes.map((flow) => [
    flow,
    Object.entries(fieldsResult.value[flow] || {})
      .filter(([, metadata]) => metadata.required)
      .map(([field]) => field)
  ]));
  return {
    value: {
      schemaVersion: 3,
      membershipTypes,
      regions: regionsResult.value,
      addressLookupAvailable: false,
      fields: fieldsResult.value,
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
    if (application.type !== "craft") return res.status(400).json({ message: "Only craft applications can be reviewed" });
    await updateStore((state) => {
      const stored = state.applications.find((item) => item.id === req.params.id);
      stored.status = status;
      stored.reviewedAt = new Date().toISOString();
      stored.reviewedBy = req.admin.email;
      if (typeof req.body.note === "string") stored.reviewNote = req.body.note.trim().slice(0, 2000);
    });
    res.json({ message: "Application review updated", id: application.id });
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
