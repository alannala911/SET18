// Definerer administratorruter for medlemmer, søknader, skjemaer og innstillinger
import express from "express";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readStore, readUpload, updateStore } from "../lib/store.js";
import { createToken, normalizeEmail, tokenHash } from "../lib/security.js";
import {
  agreementsFrom,
  isOfferChannel,
  isRecord,
  memberEmail,
  memberPhone,
  memberSummary,
  offerRecipients,
  phoneDigits,
} from "../lib/members.js";
import { recordAudit } from "../lib/audit.js";
import { requireAdmin } from "./auth.js";

const router = express.Router();
const formTypes = ["regular", "minor", "gift", "craft"];
const APPLICATION_NOT_FOUND = "Søknaden ble ikke funnet";

function validStringArray(value, maxLength = 100) {
  return (
    Array.isArray(value) &&
    value.length <= maxLength &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0 &&
        item.length <= 100,
    )
  );
}

function validFieldName(field) {
  return (
    typeof field === "string" &&
    /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){0,4}$/.test(field) &&
    field.length <= 150
  );
}

function sanitizeRegions(value) {
  if (!Array.isArray(value) || value.length > 200)
    return { error: "regions må være en liste med maksimalt 200 oppføringer" };
  const regions = [];
  for (const region of value) {
    if (
      !isRecord(region) ||
      typeof region.name !== "string" ||
      !region.name.trim() ||
      region.name.length > 100 ||
      !validStringArray(region.chapters, 200)
    ) {
      return { error: "Hver region må ha et navn og en chapters-liste" };
    }
    regions.push({
      name: region.name.trim(),
      chapters: region.chapters.map((chapter) => chapter.trim()),
    });
  }
  if (new Set(regions.map((region) => region.name)).size !== regions.length) {
    return { error: "Regionnavn må være unike" };
  }
  return { value: regions };
}

function sanitizeFields(existing, input) {
  if (!isRecord(input)) return { error: "fields må være et objekt" };
  const result = structuredClone(existing);
  for (const flow of Object.keys(input)) {
    if (!formTypes.includes(flow) || !isRecord(input[flow]))
      return { error: `fields.${flow} må være et objekt` };
    for (const [field, metadata] of Object.entries(input[flow])) {
      if (!validFieldName(field) || !isRecord(metadata))
        return { error: `fields.${flow}.${field} er ugyldig` };
      const current = result[flow]?.[field] || {
        visible: true,
        required: false,
      };
      const visible =
        metadata.visible === undefined ? current.visible : metadata.visible;
      const required =
        metadata.required === undefined ? current.required : metadata.required;
      if (typeof visible !== "boolean" || typeof required !== "boolean") {
        return {
          error: `fields.${flow}.${field} må ha boolske verdier for visible og required`,
        };
      }
      if (required && !visible)
        return { error: `Det obligatoriske feltet ${field} må være synlig` };
      let label = current.label;
      if (Object.hasOwn(metadata, "label")) {
        if (typeof metadata.label !== "string" || metadata.label.length > 100) {
          return {
            error: `fields.${flow}.${field}.label må være en tekst på maksimalt 100 tegn`,
          };
        }
        label = metadata.label.trim();
        if (!label) label = undefined;
      }
      result[flow] ??= {};
      result[flow][field] = {
        visible,
        required,
        ...(label ? { label } : {}),
      };
    }
  }
  if (
    Object.values(result).some((fields) => Object.keys(fields).length > 150)
  ) {
    return { error: "Maksimalt 150 konfigurerbare felt er tillatt per flyt" };
  }
  return { value: result };
}

function sanitizeOptions(existing, input) {
  if (!isRecord(input)) return { error: "options må være et objekt" };
  const result = structuredClone(existing || {});
  for (const flow of Object.keys(input)) {
    if (!formTypes.includes(flow) || !isRecord(input[flow]))
      return { error: `options.${flow} må være et objekt` };
    result[flow] ??= {};
    for (const [field, values] of Object.entries(input[flow])) {
      if (!validFieldName(field) || !validStringArray(values, 100)) {
        return {
          error: `options.${flow}.${field} må være en liste med opptil 100 ikke-tomme tekster`,
        };
      }
      const cleanValues = values.map((value) => value.trim());
      if (new Set(cleanValues).size !== cleanValues.length)
        return {
          error: `options.${flow}.${field} kan ikke inneholde duplikater`,
        };
      result[flow][field] = cleanValues;
    }
  }
  if (
    Object.values(result).some((options) => Object.keys(options).length > 150)
  ) {
    return { error: "Maksimalt 150 alternativlister er tillatt per flyt" };
  }
  return { value: result };
}

const fieldTypes = new Set([
  "text",
  "textarea",
  "email",
  "phone",
  "date",
  "select",
  "checkbox",
  "file",
  "section",
]);

function sanitizeFormFields(input, label) {
  if (!Array.isArray(input) || input.length > 100)
    return { error: `${label} kan inneholde maksimalt 100 felt` };
  const ids = new Set();
  const fields = [];
  for (const field of input) {
    if (
      !isRecord(field) ||
      typeof field.id !== "string" ||
      !/^[a-z][a-z0-9_]{1,49}$/.test(field.id) ||
      ids.has(field.id) ||
      !fieldTypes.has(field.type) ||
      typeof field.label !== "string" ||
      !field.label.trim() ||
      field.label.length > 120 ||
      typeof field.required !== "boolean"
    ) {
      return { error: `${label} inneholder et ugyldig felt` };
    }
    ids.add(field.id);
    const clean = {
      id: field.id,
      type: field.type,
      label: field.label.trim(),
      required: field.type === "section" ? false : field.required,
    };
    if (field.type === "select") {
      if (!validStringArray(field.options, 100))
        return { error: `${label}.${field.id} må ha valg for select-feltet` };
      clean.options = field.options.map((option) => option.trim());
      if (new Set(clean.options).size !== clean.options.length) {
        return { error: `${label}.${field.id}-alternativene må være unike` };
      }
    }
    if (field.type === "section") {
      if (typeof field.content !== "string" || field.content.length > 2000) {
        return {
          error: `${label}.${field.id} må ha seksjonsinnhold på maksimalt 2000 tegn`,
        };
      }
      clean.content = field.content.trim();
    }
    fields.push(clean);
  }
  return { value: fields };
}

function sanitizeAdditionalFields(existing, input) {
  if (!isRecord(input)) return { error: "additionalFields må være et objekt" };
  const result = { ...existing };
  for (const [flow, fields] of Object.entries(input)) {
    if (!formTypes.includes(flow))
      return { error: `additionalFields.${flow} er ugyldig` };
    const sanitized = sanitizeFormFields(fields, `additionalFields.${flow}`);
    if (sanitized.error) return sanitized;
    if (sanitized.value.some((field) => field.type === "file")) {
      return {
        error:
          "Filopplasting støttes bare for helt egendefinerte skjemaer og forhåndsinnstillingen craft",
      };
    }
    result[flow] = sanitized.value;
  }
  for (const flow of formTypes) result[flow] ??= [];
  return { value: result };
}

function sanitizeSections(existing, input) {
  if (!isRecord(input)) return { error: "sections må være et objekt" };
  const result = structuredClone(existing || {});
  for (const [flow, sections] of Object.entries(input)) {
    if (!formTypes.includes(flow) || !isRecord(sections))
      return { error: `sections.${flow} må være et objekt` };
    result[flow] ??= {};
    for (const [key, section] of Object.entries(sections)) {
      if (
        !key.trim() ||
        key.length > 120 ||
        ["__proto__", "prototype", "constructor"].includes(key) ||
        !isRecord(section)
      )
        return { error: `sections.${flow}.${key} er ugyldig` };
      const current = result[flow][key] || {};
      const next = { ...current };
      if (section.label !== undefined) {
        if (typeof section.label !== "string" || section.label.length > 120) {
          return {
            error: `sections.${flow}.${key}.label kan være på maksimalt 120 tegn`,
          };
        }
        next.label = section.label.trim();
      }
      if (section.description !== undefined) {
        if (
          typeof section.description !== "string" ||
          section.description.length > 2000
        ) {
          return {
            error: `sections.${flow}.${key}.description kan være på maksimalt 2000 tegn`,
          };
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
  if (!Array.isArray(input) || input.length > 25)
    return { error: "customForms må være en liste med maksimalt 25 skjemaer" };
  const forms = [];
  const ids = new Set();
  for (const form of input) {
    if (
      !isRecord(form) ||
      typeof form.id !== "string" ||
      !/^custom_[a-z0-9_]{3,48}$/.test(form.id) ||
      ids.has(form.id) ||
      typeof form.name !== "string" ||
      !form.name.trim() ||
      form.name.length > 100 ||
      typeof form.description !== "string" ||
      form.description.length > 1000 ||
      typeof form.active !== "boolean" ||
      (form.includeAgreements !== undefined &&
        typeof form.includeAgreements !== "boolean")
    ) {
      return { error: "customForms inneholder et ugyldig skjema" };
    }
    const sanitized = sanitizeFormFields(
      form.fields,
      `customForms.${form.id}.fields`,
    );
    if (sanitized.error) return sanitized;
    if (
      form.active &&
      !sanitized.value.some((field) => field.type !== "section")
    ) {
      return {
        error: `${form.name} må ha minst ett inndatafelt før det kan aktiveres`,
      };
    }
    ids.add(form.id);
    forms.push({
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim(),
      active: form.active,
      includeAgreements: form.includeAgreements ?? true,
      fields: sanitized.value,
    });
  }
  return { value: forms };
}

function sanitizeMembershipTypes(existingTypes, inputTypes) {
  const membershipTypes = { ...existingTypes };
  if (inputTypes !== undefined) {
    if (!isRecord(inputTypes))
      return { error: "membershipTypes må være et objekt" };
    for (const [type, enabled] of Object.entries(inputTypes)) {
      if (!formTypes.includes(type) || typeof enabled !== "boolean") {
        return { error: `membershipTypes.${type} må være en boolsk verdi` };
      }
      membershipTypes[type] = enabled;
    }
  }
  for (const type of formTypes) {
    if (typeof membershipTypes[type] !== "boolean") {
      return { error: `membershipTypes.${type} må være en boolsk verdi` };
    }
  }
  return { value: membershipTypes };
}

function sanitizeConfigSections(existing, input) {
  const sections = [
    ["regions", () => existing.regions, (value) => sanitizeRegions(value)],
    [
      "fields",
      () => structuredClone(existing.fields),
      (value) => sanitizeFields(existing.fields, value),
    ],
    [
      "options",
      () => structuredClone(existing.options || {}),
      (value) => sanitizeOptions(existing.options || {}, value),
    ],
    [
      "additionalFields",
      () =>
        structuredClone(
          existing.additionalFields || {
            regular: [],
            minor: [],
            gift: [],
            craft: [],
          },
        ),
      (value) =>
        sanitizeAdditionalFields(existing.additionalFields || {}, value),
    ],
    [
      "sections",
      () =>
        structuredClone(
          existing.sections || { regular: {}, minor: {}, gift: {}, craft: {} },
        ),
      (value) => sanitizeSections(existing.sections || {}, value),
    ],
    [
      "customForms",
      () => structuredClone(existing.customForms || []),
      (value) => sanitizeCustomForms(value),
    ],
  ];
  const values = {};
  for (const [name, defaultValue, sanitize] of sections) {
    const result =
      input[name] === undefined
        ? { value: defaultValue() }
        : sanitize(input[name]);
    if (result.error) return result;
    values[name] = result.value;
  }
  return { value: values };
}

function requireMinorContactFields(fields) {
  for (const field of ["child.email", "child.phone"]) {
    fields.minor[field] = {
      ...fields.minor[field],
      visible: true,
      required: true,
    };
  }
  delete fields.minor.password;
  delete fields.minor.confirmPassword;
}

function requiredFieldsFromConfig(fields) {
  const requiredFields = Object.fromEntries(
    formTypes.map((flow) => [
      flow,
      Object.entries(fields[flow] || {})
        .filter(
          ([field, metadata]) =>
            metadata.required && !(flow === "minor" && field === "password"),
        )
        .map(([field]) => field),
    ]),
  );
  requiredFields.minor = [
    ...new Set([...requiredFields.minor, "child.email", "child.phone"]),
  ];
  return requiredFields;
}

function buildConfig(existing, input) {
  if (!isRecord(input)) return { error: "Konfigurasjonen må være et objekt" };

  const membershipTypes = sanitizeMembershipTypes(
    existing.membershipTypes,
    input.membershipTypes,
  );
  if (membershipTypes.error) return membershipTypes;

  const configSections = sanitizeConfigSections(existing, input);
  if (configSections.error) return configSections;
  const { regions, fields, options, additionalFields, sections, customForms } =
    configSections.value;
  requireMinorContactFields(fields);

  if (
    input.craftShippingInstructions !== undefined &&
    (typeof input.craftShippingInstructions !== "string" ||
      input.craftShippingInstructions.length > 5000)
  ) {
    return {
      error:
        "craftShippingInstructions må være en tekst på maksimalt 5000 tegn",
    };
  }

  return {
    value: {
      schemaVersion: 4,
      membershipTypes: membershipTypes.value,
      regions,
      addressLookupAvailable: false,
      fields,
      sections,
      additionalFields,
      customForms,
      requiredFields: requiredFieldsFromConfig(fields),
      options,
      craftShippingInstructions:
        input.craftShippingInstructions === undefined
          ? existing.craftShippingInstructions || ""
          : input.craftShippingInstructions.trim(),
    },
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
    craftShippingInstructions: config.craftShippingInstructions || "",
  });
});

router.put("/config", async (req, res, next) => {
  try {
    const result = buildConfig(readStore().config, req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    await updateStore((state) => {
      state.config = result.value;
      recordAudit(state, req, "config.update");
    });
    res.json({ message: "Konfigurasjonen er oppdatert" });
  } catch (error) {
    next(error);
  }
});

function publicApplication(application) {
  const { activationTokenHash, ...safe } = application;
  return {
    ...safe,
    files: (application.files || []).map(
      ({ id, originalName, size, mimeType }) => ({
        id,
        originalName,
        size,
        mimeType,
      }),
    ),
  };
}

router.post("/offers/test", (req, res) => {
  const { channel, message } = req.body || {};
  if (
    !isOfferChannel(channel) ||
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 1000
  ) {
    return res
      .status(400)
      .json({
        message:
          "Velg e-post eller SMS og skriv en melding på maksimalt 1000 tegn",
      });
  }
  const recipients = offerRecipients(readStore().members, channel);
  console.log(
    `[Dummy-${channel}] "${message.trim()}" til ${recipients.length} mottaker(e)`,
  );
  res.json({
    message: `Dummy-utsending: ${recipients.length} mottaker(e) ville fått meldingen. Ingenting er sendt.`,
    recipients: recipients.map(({ contact }) => contact),
  });
});

const csvColumns = [
  ["name", "Navn"],
  ["email", "E-post"],
  ["phone", "Telefon"],
  ["type", "Type"],
  ["status", "Status"],
  ["region", "Region"],
  ["chapter", "Lokallag"],
  ["validUntil", "Gyldig til"],
  ["emailOffers", "E-posttilbud"],
  ["smsOffers", "SMS-tilbud"],
  ["createdAt", "Registrert"],
];

function memberMatchesFilters(member, query, search) {
  if (
    search &&
    ![member.name, member.email, member.phone].some((value) =>
      value.toLocaleLowerCase("nb-NO").includes(search),
    )
  )
    return false;
  if (query.type && member.type !== query.type) return false;
  if (query.status && member.status !== query.status) return false;
  if (query.region && member.localGroup?.region !== query.region) return false;
  if (query.expired && member.expired !== (query.expired === "true"))
    return false;
  return true;
}

function filteredMembers(query) {
  const search = String(query.search || "")
    .trim()
    .toLocaleLowerCase("nb-NO");
  return readStore()
    .members.map(memberSummary)
    .filter((member) => memberMatchesFilters(member, query, search));
}

const csvCell = (value) => {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};

router.get("/members", (req, res) => {
  res.json({ members: filteredMembers(req.query) });
});

router.get("/members/export", (req, res) => {
  const rows = filteredMembers(req.query).map((member) => ({
    ...member,
    region: member.localGroup?.region,
    chapter: member.localGroup?.chapter,
  }));
  const csv = [
    csvColumns.map(([, label]) => csvCell(label)).join(";"),
    ...rows.map((row) =>
      csvColumns.map(([key]) => csvCell(row[key])).join(";"),
    ),
  ].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="medlemmer.csv"');
  res.send(`\uFEFF${csv}`);
});

function validateMemberUpdate(input, regions) {
  const { status, validUntil, localGroup } = input || {};
  const invalidStatus =
    status !== undefined && !["active", "suspended"].includes(status);
  const invalidValidUntil =
    validUntil !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil);
  const invalidLocalGroup =
    localGroup !== undefined &&
    !regions.some(
      (region) =>
        region.name === localGroup?.region &&
        region.chapters.includes(localGroup?.chapter),
    );
  if (invalidStatus || invalidValidUntil || invalidLocalGroup) {
    return { error: "Status, gyldighetsdato eller lokallag er ugyldig" };
  }
  return { value: { status, validUntil, localGroup } };
}

function updateMemberRecord(state, req, memberId, changes) {
  const storedMember = state.members.find((member) => member.id === memberId);
  if (!storedMember) return null;

  const { status, validUntil, localGroup } = changes;
  if (status && ["active", "suspended"].includes(storedMember.status)) {
    storedMember.status = status;
  }
  if (status === "suspended") {
    state.sessions = state.sessions.filter(
      (session) => session.memberId !== storedMember.id,
    );
  }
  if (validUntil) storedMember.validUntil = validUntil;
  if (localGroup) {
    storedMember.profile.localGroup = {
      region: localGroup.region,
      chapter: localGroup.chapter,
    };
  }
  recordAudit(state, req, "member.update", {
    memberId: storedMember.id,
    status,
    validUntil,
  });
  return storedMember;
}

router.patch("/members/:id", async (req, res, next) => {
  try {
    const validation = validateMemberUpdate(
      req.body,
      readStore().config.regions,
    );
    if (validation.error)
      return res.status(400).json({ message: validation.error });

    const member = await updateStore((state) =>
      updateMemberRecord(state, req, req.params.id, validation.value),
    );
    if (!member)
      return res.status(404).json({ message: "Medlemmet ble ikke funnet" });
    res.json(memberSummary(member));
  } catch (error) {
    next(error);
  }
});

router.get("/audit-log", (req, res) => {
  res.json({ entries: readStore().auditLog.slice(-200).reverse() });
});

router.get("/applications", (req, res) => {
  res.json({ applications: readStore().applications.map(publicApplication) });
});

function reviewStoredApplication(
  state,
  req,
  status,
  setupToken,
  setupTokenHash,
  setupExpiresAt,
) {
  const application = state.applications.find(
    (item) => item.id === req.params.id,
  );
  if (!application) return { error: APPLICATION_NOT_FOUND };

  application.status = status;
  application.reviewedAt = new Date().toISOString();
  application.reviewedBy = req.admin.email;
  recordAudit(state, req, "application.review", {
    applicationId: application.id,
    status,
  });
  if (typeof req.body.note === "string")
    application.reviewNote = req.body.note.trim().slice(0, 2000);
  if (application.type !== "craft" || status !== "approved") {
    return { message: "Søknadsbehandlingen er oppdatert" };
  }

  const applicant = application.profile?.applicant;
  if (!applicant?.email) {
    return {
      error: "Søknaden om håndverksmedlemskap mangler søkerens e-postadresse",
    };
  }

  let member =
    application.memberId &&
    state.members.find((item) => item.id === application.memberId);
  if (!member) {
    const applicantEmail = normalizeEmail(applicant.email);
    const applicantPhone = phoneDigits(applicant.phone);
    member = state.members.find(
      (item) =>
        normalizeEmail(memberEmail(item)) === applicantEmail ||
        (applicantPhone && phoneDigits(memberPhone(item)) === applicantPhone),
    );
    if (member) {
      application.memberId = member.id;
      return {
        message:
          "Søknaden er godkjent. Søkeren har allerede en medlemskonto, og det ble ikke opprettet noen ny lenke for passordoppsett.",
      };
    }

    member = {
      id: randomUUID(),
      type: "craft",
      status: "pending_activation",
      profile: {
        applicant,
        business: application.profile.business || {},
        localGroup: application.profile.localGroup || {
          region: "",
          chapter: "",
        },
        ...agreementsFrom(application.profile),
      },
      createdAt: new Date().toISOString(),
    };
    state.members.push(member);
    application.memberId = member.id;
  }

  if (member.status === "active") {
    return {
      message: "Søknaden er godkjent. Medlemskontoen er allerede aktiv.",
    };
  }
  member.credentialSetupTokenHash = setupTokenHash;
  member.credentialSetupExpiresAt = setupExpiresAt;
  const frontendBase = (
    process.env.PUBLIC_FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
  return {
    message:
      "Søknaden er godkjent. Del lenken for passordoppsett med søkeren på en sikker måte.",
    activationUrl: `${frontendBase}/medlemskap?aktiver-haandverker=${encodeURIComponent(setupToken)}`,
  };
}

router.patch("/applications/:id", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!["pending_review", "approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({
          message: "status må være pending_review, approved eller rejected",
        });
    }
    const application = readStore().applications.find(
      (item) => item.id === req.params.id,
    );
    if (!application)
      return res.status(404).json({ message: APPLICATION_NOT_FOUND });
    if (!["craft", "custom"].includes(application.type)) {
      return res
        .status(400)
        .json({ message: "Bare craft- og custom-søknader kan behandles" });
    }
    if (
      application.type === "craft" &&
      status === "approved" &&
      !application.profile?.applicant?.email
    ) {
      return res
        .status(400)
        .json({
          message:
            "Søknaden om håndverksmedlemskap mangler søkerens e-postadresse",
        });
    }
    const setupToken =
      application.type === "craft" && status === "approved"
        ? createToken()
        : "";
    const setupTokenHash = setupToken ? tokenHash(setupToken) : "";
    const setupExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = await updateStore((state) =>
      reviewStoredApplication(
        state,
        req,
        status,
        setupToken,
        setupTokenHash,
        setupExpiresAt,
      ),
    );
    if (result.error) {
      return res
        .status(result.error === APPLICATION_NOT_FOUND ? 404 : 400)
        .json({ message: result.error });
    }
    res.json({ ...result, id: application.id });
  } catch (error) {
    next(error);
  }
});

router.get("/applications/:id/files/:fileId", async (req, res, next) => {
  const application = readStore().applications.find(
    (item) => item.id === req.params.id,
  );
  const file = application?.files?.find(
    (item) => item.id === req.params.fileId,
  );
  if (!file) return res.status(404).json({ message: "Filen ble ikke funnet" });
  try {
    const content = await readUpload(
      path.join(application.id, file.storageName),
    );
    if (!content)
      return res.status(404).json({ message: "Filen ble ikke funnet" });
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(file.originalName).replace(/["\\\r\n]/g, "_")}"`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(content);
  } catch (error) {
    next(error);
  }
});

export default router;
