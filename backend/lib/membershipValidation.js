// Validerer og renser medlemsdata og skjemainnsendinger
import { readStore } from "./store.js";
import { normalizeEmail, validEmail } from "./security.js";
import { isRecord, memberEmail, memberPhone, phoneDigits } from "./members.js";

export const FORM_DATA_ERROR_PREFIX = "Skjemadata";

//* Renser skjemadata rekursivt og begrenser dybde, lengde og felt som kan lagres
export function sanitizeValue(value, depth = 0, root = true) {
  if (depth > 6)
    throw new Error(`${FORM_DATA_ERROR_PREFIX} er nøstet for dypt`);
  if (typeof value === "string") return value.trim().slice(0, 2000);
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (value.length > 20)
      throw new Error(
        `${FORM_DATA_ERROR_PREFIX} inneholder for mange elementer`,
      );
    return value.map((item) => sanitizeValue(item, depth + 1, false));
  }
  if (isRecord(value)) {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (
        !/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(key) || 
        [
          "__proto__",
          "prototype",
          "constructor",
          "passwordHash",
          "activationTokenHash",
          "id",
          "status",
          "createdAt",
        ].includes(key) ||
        (!root && key === "password")
      ) {
        continue;
      }
      output[key] = sanitizeValue(item, depth + 1, false);
    }
    return output;
  }
  if (value === null || value === undefined) return "";
  throw new Error(
    `${FORM_DATA_ERROR_PREFIX}-verdier må være tekst, boolske verdier, tall, lister eller objekter`,
  );
}

//* Henter feltverdier fra ulike skjemaformater og nøstede profiler
function fieldValue(values, flow, field) {
  if (field === "files") return values.__fileCount || 0;
  if (flow === "regular" && field.startsWith("person.")) {
    return (
      values.person?.[field.slice("person.".length)] ??
      values[field.slice("person.".length)]
    );
  }
  if (flow === "minor" && field.startsWith("parent.")) {
    return values.parents?.[0]?.[field.slice("parent.".length)];
  }
  if (field.startsWith("localGroup.")) {
    return (
      values.localGroup?.[field.slice("localGroup.".length)] ??
      values[field.slice("localGroup.".length)]
    );
  }
  return field.split(".").reduce((value, part) => value?.[part], values);
}

//* Kontrollerer obligatoriske standardfelt og administratoropprettede felt
export function checkRequired(values, flow) {
  const config = readStore().config;
  const required = [
    ...(config.requiredFields?.[flow] || []),
    ...(config.additionalFields?.[flow] || [])
      .filter((field) => field.required)
      .map((field) => field.id),
  ];
  return required
    .filter((field) => flow !== "minor" || field !== "password")
    .filter((field) => field !== "confirmPassword")
    .filter((field) => {
      const additional = (config.additionalFields?.[flow] || []).find(
        (item) => item.id === field,
      );
      if (additional?.type === "section") return false;
      if (additional?.type === "file") return !(values.__fileCount > 0);
      const value = fieldValue(values, flow, field);
      return typeof value === "string"
        ? !value.trim()
        : value === undefined || value === null || value === false;
    });
}

//* Validerer konfigurerte valgalternativer og typer for egendefinerte felt
export function validateOptions(values, flow) {
  const fields = readStore().config.options?.[flow] || {};
  for (const [field, allowed] of Object.entries(fields)) {
    if (!Array.isArray(allowed)) continue;
    const value = fieldValue(values, flow, field);
    if (value && !allowed.includes(value))
      return `${field} must be one of the configured options`;
  }
  for (const field of readStore().config.additionalFields?.[flow] || []) {
    const value = values[field.id];
    if (value === undefined || value === "") continue;
    if (field.type === "select" && !field.options.includes(value)) {
      return `${field.id} must be one of the configured options`;
    }
    if (field.type === "checkbox" && typeof value !== "boolean") {
      return `${field.id} must be a checkbox value`;
    }
    if (
      ["text", "textarea", "email", "phone", "date", "select"].includes(
        field.type,
      ) &&
      typeof value !== "string"
    ) {
      return `${field.id} must be text`;
    }
    if (field.type === "email" && !validEmail(normalizeEmail(value))) {
      return `${field.id} must be a valid email address`;
    }
    if (field.type === "phone" && !normalizedPhone(value)) {
      return `${field.id} must be a valid phone number`;
    }
    if (field.type === "date" && value && !validDateString(value)) {
      return `${field.id} must be a valid date`;
    }
  }
  return null;
}

//* Beregner alder etter å ha kontrollert at fødselsdatoen er gyldig
export function ageOnDate(dateString) {
  if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString))
    return null;
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateString
  )
    return null;
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  if (
    today.getUTCMonth() < date.getUTCMonth() ||
    (today.getUTCMonth() === date.getUTCMonth() &&
      today.getUTCDate() < date.getUTCDate())
  )
    age -= 1;
  return age < 0 ? null : age;
}

export function validDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

//* Kontrollerer at valgt lokallag tilhører en konfigurert region
export function validateRegion(group, flow) {
  const regions = readStore().config.regions || [];
  if (!regions.length) return null;
  const groupRequired = (readStore().config.requiredFields?.[flow] || []).some(
    (field) => field === "localGroup.region" || field === "localGroup.chapter",
  );
  if (!group?.region && !group?.chapter && !groupRequired) return null;
  const region = regions.find((item) => item.name === group?.region);
  if (!region) return "Velg en tilgjengelig region";
  if (
    (groupRequired || group.region || group.chapter) &&
    !region.chapters.includes(group.chapter)
  ) {
    return "Velg et tilgjengelig lokallag i denne regionen";
  }
  return null;
}

export function groupFrom(values) {
  return {
    region: values.localGroup?.region || values.region || "",
    chapter: values.localGroup?.chapter || values.chapter || "",
  };
}

export function personEmail(person, label) {
  const email = normalizeEmail(person?.email);
  return validEmail(email)
    ? { email }
    : { error: `${label} må være en gyldig e-postadresse` };
}

export function normalizeAddress(value) {
  return {
    street: value?.street || "",
    postalCode: value?.postalCode || "",
    city: value?.city || "",
  };
}

//* Samler medlemsopplysninger i et felles profilformat
export function regularProfile(values) {
  const person = values.person || {
    firstName: values.firstName,
    middleName: values.middleName,
    lastName: values.lastName,
    gender: values.gender,
    email: values.email,
    phone: values.phone,
  };
  return {
    birthDate: values.birthDate,
    person: { ...person, email: normalizeEmail(person.email) },
    address: normalizeAddress(values.address),
    localGroup: groupFrom(values),
  };
}

//* Normaliserer telefonnumre før validering og sammenligning
export function normalizedPhone(phone) {
  if (typeof phone !== "string" || !/^\+?[0-9().\s-]+$/.test(phone)) return "";
  const digits = phoneDigits(phone);
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

export function validatePhone(phone, label) {
  if (!normalizedPhone(phone))
    return `${label} må være et gyldig telefonnummer`;
  return null;
}

//* Hindrer at eksisterende medlemmer deler e-postadresse eller telefonnummer
export function memberConflict(state, email, phone, excludedMemberId = "") {
  const normalized = normalizedPhone(phone);
  return state.members.some(
    (item) =>
      item.id !== excludedMemberId &&
      ((email && memberEmail(item) === email) ||
        (normalized && normalizedPhone(memberPhone(item)) === normalized)),
  );
}

//* Sjekker kontaktopplysninger mot gaveaktiveringer som fortsatt er gyldige
export function pendingGiftConflict(state, email, phone) {
  const normalized = normalizedPhone(phone);
  return state.applications.some(
    (item) =>
      item.type === "gift" &&
      item.status === "pending_activation" &&
      Date.parse(item.activationExpiresAt) > Date.now() &&
      ((email && item.profile?.recipient?.email === email) ||
        (normalized &&
          normalizedPhone(item.profile?.recipient?.phone) === normalized)),
  );
}

//* Kontrollerer at identifikatoren samsvarer med registrert e-post eller telefon
export function contactMatches(identifier, email, phone) {
  const normalizedEmail = normalizeEmail(identifier);
  if (validEmail(normalizedEmail) && normalizeEmail(email) === normalizedEmail)
    return true;
  const normalized = normalizedPhone(identifier);
  return Boolean(normalized && normalizedPhone(phone) === normalized);
}
