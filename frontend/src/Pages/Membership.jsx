import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Membership.css";

const API = import.meta.env.VITE_API_BASE_URL || "/api";
const FormConfigContext = createContext(null);
const membershipTypes = [
  ["regular", "Vanlig medlemskap"],
  ["minor", "Mindreårig medlemskap"],
  ["gift", "Gi medlemskap i gave"],
  ["craft", "Husflidshåndverker"],
];
const builderFieldTypes = [
  ["text", "Kort tekst"],
  ["textarea", "Lang tekst"],
  ["email", "E-post"],
  ["phone", "Telefon"],
  ["date", "Dato"],
  ["select", "Nedtrekksliste"],
  ["checkbox", "Avkrysningsboks"],
  ["file", "Filopplasting"],
  ["section", "Innholdsboks"],
];
const presetFieldTypes = builderFieldTypes.filter(([type]) => type !== "file");
const configurableSections = {
  regular: ["Alderskontroll", "Personlig informasjon", "Passord", "Adresse", "Velg lokallag"],
  minor: ["Barnets informasjon", "Barnets alder", "Forelders informasjon", "Forelder 2", "Forelder 3", "Forelder 4", "Passord", "Adresse", "Velg lokallag"],
  gift: ["Kjøperens alderskontroll", "Kjøperens personlige informasjon", "Kjøperens adresse", "Mottakerens alderskontroll", "Mottakerens personlige informasjon", "Mottakerens adresse", "Foresattens informasjon", "Velg lokallag"],
  craft: ["Bedriftsinformasjon", "Bedriftens adresse", "Søkerens personinformasjon", "Søkerens fødselsdato og adresse", "Søkerens adresse", "Håndverkstype", "Last opp dokumentasjon", "Juryert opptak", "Velg lokallag"],
};

function createBuilderField(type = "text") {
  const id = `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  return {
    id,
    type,
    label: type === "section" ? "Ny innholdsboks" : "Nytt felt",
    required: false,
    ...(type === "select" ? { options: ["Alternativ 1"] } : {}),
    ...(type === "section" ? { content: "" } : {}),
  };
}

function BuilderFieldEditor({ field, onChange, onRemove, allowFiles = true }) {
  const fieldTypes = allowFiles ? builderFieldTypes : presetFieldTypes;
  return (
    <div className="builder-field-editor">
      <label className="membership-field">
        <span>Felttype</span>
        <select value={field.type} onChange={(event) => {
          const next = createBuilderField(event.target.value);
          onChange({ ...next, id: field.id, label: field.label });
        }}>
          {fieldTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="membership-field">
        <span>{field.type === "section" ? "Overskrift" : "Feltetikett"}</span>
        <input value={field.label} maxLength={120} onChange={(event) => onChange({ ...field, label: event.target.value })} />
      </label>
      {field.type === "select" && <label className="membership-field membership-grid-wide">
        <span>Valg (ett per linje)</span>
        <textarea rows="3" value={(field.options || []).join("\n")} onChange={(event) => onChange({ ...field, options: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
      </label>}
      {field.type === "section" && <label className="membership-field membership-grid-wide">
        <span>Innholdstekst</span>
        <textarea rows="3" value={field.content || ""} maxLength={2000} onChange={(event) => onChange({ ...field, content: event.target.value })} />
      </label>}
      {field.type !== "section" && <label className="membership-check">
        <input type="checkbox" checked={Boolean(field.required)} onChange={(event) => onChange({ ...field, required: event.target.checked })} />
        Obligatorisk
      </label>}
      <button className="membership-text-button" type="button" onClick={onRemove}>Fjern felt</button>
    </div>
  );
}

const configurableFields = {
  regular: [
    ["birthDate", "Fødselsdato", true, "Påkrevd for alderskontroll"],
    ["person.firstName", "Fornavn", true],
    ["person.middleName", "Mellomnavn", false],
    ["person.lastName", "Etternavn", true],
    ["person.gender", "Kjønn", true],
    ["person.email", "E-post", true, "Påkrevd for medlemskonto"],
    ["person.phone", "Telefonnummer", true, "Påkrevd for medlemskonto"],
    ["password", "Passord", true, "Påkrevd for medlemskonto"],
    ["confirmPassword", "Bekreft passord", true],
    ["address.street", "Gateadresse", true],
    ["address.postalCode", "Postnummer", true],
    ["address.city", "Poststed", true],
    ["localGroup.region", "Region", true],
    ["localGroup.chapter", "Lokallag", true],
  ],
  minor: [
    ["child.firstName", "Barnets fornavn", true],
    ["child.middleName", "Barnets mellomnavn", false],
    ["child.lastName", "Barnets etternavn", true],
    ["child.gender", "Barnets kjønn", true],
    ["child.email", "Barnets e-post", true, "Påkrevd for barnets innlogging"],
    ["child.phone", "Barnets telefonnummer", true, "Påkrevd for barnets innlogging"],
    ["child.birthDate", "Barnets fødselsdato", true, "Påkrevd for alderskontroll"],
    ["parent.firstName", "Forelders fornavn", true, "Påkrevd for foresatt"],
    ["parent.middleName", "Forelders mellomnavn", false],
    ["parent.lastName", "Forelders etternavn", true, "Påkrevd for foresatt"],
    ["parent.gender", "Forelders kjønn", true, "Påkrevd for foresatt"],
    ["parent.email", "Forelders e-post", true, "Påkrevd for foresatt"],
    ["parent.phone", "Forelders telefonnummer", true, "Påkrevd for foresatt"],
    ["address.street", "Gateadresse", true],
    ["address.postalCode", "Postnummer", true],
    ["address.city", "Poststed", true],
    ["localGroup.region", "Region", true],
    ["localGroup.chapter", "Lokallag", true],
    ["consent", "Samtykke fra foresatt", true],
  ],
  gift: [
    ["purchaser.birthDate", "Kjøperens fødselsdato", true, "Påkrevd for alderskontroll"],
    ["purchaser.firstName", "Kjøperens fornavn", true],
    ["purchaser.middleName", "Kjøperens mellomnavn", false],
    ["purchaser.lastName", "Kjøperens etternavn", true],
    ["purchaser.gender", "Kjøperens kjønn", true],
    ["purchaser.email", "Kjøperens e-post", true, "Påkrevd for kontakt"],
    ["purchaser.phone", "Kjøperens telefonnummer", true, "Påkrevd for kontakt"],
    ["purchaser.address.street", "Kjøperens gateadresse", true],
    ["purchaser.address.postalCode", "Kjøperens postnummer", true],
    ["purchaser.address.city", "Kjøperens poststed", true],
    ["recipient.birthDate", "Mottakerens fødselsdato", true, "Påkrevd for alderskontroll"],
    ["recipient.firstName", "Mottakerens fornavn", true],
    ["recipient.middleName", "Mottakerens mellomnavn", false],
    ["recipient.lastName", "Mottakerens etternavn", true],
    ["recipient.gender", "Mottakerens kjønn", true],
    ["recipient.email", "Mottakerens e-post", true, "Påkrevd for medlemskonto"],
    ["recipient.phone", "Mottakerens telefonnummer", true, "Påkrevd for medlemskonto"],
    ["recipient.address.street", "Mottakerens gateadresse", true],
    ["recipient.address.postalCode", "Mottakerens postnummer", true],
    ["recipient.address.city", "Mottakerens poststed", true],
    ["guardian.firstName", "Foresattens fornavn (mottaker under 18)", false, "Påkrevd for mottaker under 18"],
    ["guardian.middleName", "Foresattens mellomnavn", false, "Påkrevd for mottaker under 18"],
    ["guardian.lastName", "Foresattens etternavn", false, "Påkrevd for mottaker under 18"],
    ["guardian.gender", "Foresattens kjønn", false, "Påkrevd for mottaker under 18"],
    ["guardian.email", "Foresattens e-post", false, "Påkrevd for mottaker under 18"],
    ["guardian.phone", "Foresattens telefonnummer", false, "Påkrevd for mottaker under 18"],
    ["consent", "Samtykke fra foresatt (mottaker under 18)", false, "Påkrevd for mottaker under 18"],
    ["localGroup.region", "Region for mottaker", false],
    ["localGroup.chapter", "Lokallag for mottaker", false],
  ],
  craft: [
    ["business.name", "Bedriftsnavn", true],
    ["business.organizationNumber", "Organisasjonsnummer", true],
    ["business.address.street", "Bedriftens gateadresse", true],
    ["business.address.postalCode", "Bedriftens postnummer", true],
    ["business.address.city", "Bedriftens poststed", true],
    ["business.phone", "Bedriftens telefon", true],
    ["business.email", "Bedriftens e-post", true, "Påkrevd for kontakt"],
    ["business.website", "Hjemmeside", false],
    ["business.qualificationConfirmed", "Bedriftens kvalifikasjonsbekreftelse", true, "Påkrevd"],
    ["applicant.firstName", "Søkerens fornavn", true],
    ["applicant.middleName", "Søkerens mellomnavn", false],
    ["applicant.lastName", "Søkerens etternavn", true],
    ["applicant.gender", "Søkerens kjønn", true],
    ["applicant.email", "Søkerens e-post", true, "Påkrevd for kontakt"],
    ["applicant.phone", "Søkerens telefonnummer", true],
    ["applicant.birthDate", "Søkerens fødselsdato", true, "Påkrevd for alderskontroll"],
    ["applicant.address.street", "Søkerens gateadresse", true],
    ["applicant.address.postalCode", "Søkerens postnummer", true],
    ["applicant.address.city", "Søkerens poststed", true],
    ["craftType", "Håndverkstype", true],
    ["admissionMethod", "Opptaksmetode", true, "Obligatorisk valg"],
    ["files", "Dokumentasjon eller produktbilder", true, "Påkrevd"],
    ["jury.education", "Relevant utdanning / realkompetanse", false],
    ["jury.practice", "Relevant praksis", false],
    ["jury.exhibitions", "Deltagelse på juryerte utstillinger", false],
    ["jury.awards", "Designpriser og lignende", false],
    ["jury.materials", "Materialer", false],
    ["jury.formColorDecoration", "Form, farge og dekor", false],
    ["jury.technique", "Fremstillingsteknikk", false],
    ["jury.use", "Bruksområde", false],
    ["jury.originality", "Originalitet", false],
    ["jury.photographs", "Vedlagte fotografier viser", false],
    ["localGroup.region", "Region for husflidslag", false],
    ["localGroup.chapter", "Lokallag for husflidslag", false],
    ["criteriaAccepted", "Bekreft medlemskriterier", true, "Påkrevd"],
  ],
};

const emptyAddress = { street: "", postalCode: "", city: "" };
const emptyPerson = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  email: "",
  phone: "",
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Forespørselen kunne ikke fullføres.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const [key, ...rest] = path.split(".");
  return {
    ...object,
    [key]: rest.length ? setPath(object[key] || {}, rest.join("."), value) : value,
  };
}

function getAge(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) return null;
  const birthDate = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== dateString) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (today.getUTCMonth() < birthDate.getUTCMonth() ||
      (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age < 0 ? null : age;
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validPhone(value) {
  if (!/^\+?[0-9().\s-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function fieldValueForFlow(type, form, key, parentIndex = 0) {
  if (type === "regular" && key.startsWith("person.")) {
    return form[key.slice("person.".length)];
  }
  if (type === "minor" && key.startsWith("parent.")) {
    return form.parents?.[parentIndex]?.[key.slice("parent.".length)];
  }
  if (key.startsWith("localGroup.")) {
    return form[key.slice("localGroup.".length) === "region" ? "region" : "chapter"];
  }
  return getPath(form, key);
}

function isForcedRequired(type, key, form) {
  const alwaysRequired = {
    regular: ["birthDate", "person.email", "person.phone", "password", "confirmPassword"],
    minor: [
      "child.email", "child.phone", "child.birthDate", "parent.firstName",
      "parent.lastName", "parent.gender", "parent.email", "parent.phone", "consent",
    ],
    gift: [
      "purchaser.birthDate", "purchaser.email", "purchaser.phone",
      "recipient.birthDate", "recipient.email", "recipient.phone",
    ],
    craft: [
      "business.qualificationConfirmed", "applicant.birthDate", "applicant.email",
      "applicant.phone", "criteriaAccepted",
    ],
  };
  if (alwaysRequired[type]?.includes(key)) return true;
  if (type === "gift" && getAge(form.recipient?.birthDate) < 18 &&
      ["guardian.firstName", "guardian.lastName", "guardian.gender", "guardian.email", "guardian.phone", "consent"].includes(key)) {
    return true;
  }
  return type === "craft" && key === "files" && Boolean(form.admissionMethod);
}

function isFieldRequired(type, key, form, config, defaultRequired) {
  const setting = config?.fields?.[type]?.[key];
  if (isForcedRequired(type, key, form)) return true;
  if (setting?.required !== undefined) return setting.required;
  return defaultRequired;
}

function fieldLabel(type, key, config, defaultLabel) {
  return config?.fields?.[type]?.[key]?.label || defaultLabel;
}

function registrationFieldIssue(type, key, value, required, form) {
  const missing = value === undefined || value === null ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "boolean" && required && !value);
  if (required && missing) return "må fylles inn";
  if (missing) return "";
  if (key.toLowerCase().endsWith(".email") || key === "person.email") {
    return typeof value === "string" && validEmail(value.trim())
      ? ""
      : "må være en gyldig e-postadresse";
  }
  if (key.toLowerCase().endsWith(".phone")) {
    return typeof value === "string" && validPhone(value.trim())
      ? ""
      : "må være et gyldig telefonnummer";
  }
  if (key.toLowerCase().endsWith(".postalcode")) {
    return /^\d+$/.test(String(value).trim()) ? "" : "må bare inneholde tall";
  }
  const dateRules = {
    regular: { birthDate: "adult" },
    minor: { "child.birthDate": "minor" },
    gift: { "purchaser.birthDate": "adult", "recipient.birthDate": "any" },
    craft: { "applicant.birthDate": "adult" },
  };
  const dateRule = dateRules[type]?.[key];
  if (dateRule) {
    const age = getAge(value);
    if (age === null) return "må være en gyldig dato som ikke ligger i fremtiden";
    if (age > 120) return "kan ikke være eldre enn 120 år";
    if (dateRule === "adult" && age < 18) return "må være minst 18 år";
    if (dateRule === "minor" && age >= 18) return "må være under 18 år";
  }
  if (key === "password") {
    if (typeof value !== "string" || value.length < 12) return "må være minst 12 tegn";
    return value.length <= 200 ? "" : "kan ikke være lengre enn 200 tegn";
  }
  if (key === "confirmPassword" && value !== form.password) {
    return "må være identisk med passordet";
  }
  return "";
}

function validateRegistration(type, form, config) {
  const issues = [];
  const specs = configurableFields[type] || [];
  const recipientAge = type === "gift" ? getAge(form.recipient?.birthDate) : null;
  const addIssue = (key, label, value, required) => {
    const message = registrationFieldIssue(type, key, value, required, form);
    if (message) issues.push({ key, label, message });
  };

  for (const [key, defaultLabel, defaultRequired] of specs) {
    if (type === "gift" && key.startsWith("guardian.") && !(recipientAge !== null && recipientAge < 18)) continue;
    if (type === "craft" && key === "files" && !form.admissionMethod) continue;
    const setting = config?.fields?.[type]?.[key];
    const forced = isForcedRequired(type, key, form);
    if (setting?.visible === false && !forced) continue;
    const required = isFieldRequired(type, key, form, config, defaultRequired) ||
      (key === "localGroup.chapter" && Boolean(form.region));
    const label = fieldLabel(type, key, config, defaultLabel);
    if (type === "minor" && key.startsWith("parent.")) {
      form.parents?.forEach((_, index) => {
        const path = `parents.${index}.${key.slice("parent.".length)}`;
        addIssue(path, `${label}${index > 0 ? ` (forelder ${index + 1})` : ""}`, fieldValueForFlow(type, form, key, index), required);
      });
    } else {
      addIssue(key, label, fieldValueForFlow(type, form, key), required);
    }
  }

  for (const field of config?.additionalFields?.[type] || []) {
    if (field.type === "section") continue;
    const value = form[field.id];
    const key = field.id;
    let message = registrationFieldIssue(type, key, value, field.required, form);
    if (!message && value !== undefined && value !== null && value !== "") {
      if (field.type === "email" && (typeof value !== "string" || !validEmail(value.trim()))) {
        message = "må være en gyldig e-postadresse";
      } else if (field.type === "phone" && (typeof value !== "string" || !validPhone(value.trim()))) {
        message = "må være et gyldig telefonnummer";
      } else if (field.type === "date") {
        const age = getAge(value);
        if (age === null) message = "må være en gyldig dato som ikke ligger i fremtiden";
        else if (age > 120) message = "kan ikke være eldre enn 120 år";
      } else if (/postnummer|postal.?code/i.test(`${field.id} ${field.label}`) &&
          !/^\d+$/.test(String(value).trim())) {
        message = "må bare inneholde tall";
      }
    }
    if (message) issues.push({ key, label: field.label, message });
  }
  return issues;
}

function validateCustomForm(fields, values) {
  const issues = [];
  for (const field of fields) {
    if (field.type === "section") continue;
    const value = values[field.id];
    let message = "";
    const missing = value === undefined || value === null ||
      (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && value.length === 0) ||
      (field.type === "checkbox" && value !== true);
    if (field.required && missing) {
      message = "må fylles inn";
    } else if (!missing && field.type === "email" &&
        (typeof value !== "string" || !validEmail(value.trim()))) {
      message = "må være en gyldig e-postadresse";
    } else if (!missing && field.type === "phone" &&
        (typeof value !== "string" || !validPhone(value.trim()))) {
      message = "må være et gyldig telefonnummer";
    } else if (!missing && field.type === "date") {
      const age = getAge(value);
      if (age === null) message = "må være en gyldig dato som ikke ligger i fremtiden";
      else if (age > 120) message = "kan ikke være eldre enn 120 år";
    } else if (!missing && /postnummer|postal.?code/i.test(`${field.id} ${field.label}`) &&
        !/^\d+$/.test(String(value).trim())) {
      message = "må bare inneholde tall";
    }
    if (message) issues.push({ key: field.id, label: field.label, message });
  }
  return issues;
}

function validatePasswordSetup(password, confirmPassword) {
  const issues = [];
  if (!password) issues.push({ key: "password", label: "Passord", message: "må fylles inn" });
  else if (password.length < 12) issues.push({ key: "password", label: "Passord", message: "må være minst 12 tegn" });
  else if (password.length > 200) issues.push({ key: "password", label: "Passord", message: "kan ikke være lengre enn 200 tegn" });
  if (!confirmPassword) issues.push({ key: "confirmPassword", label: "Bekreft passord", message: "må fylles inn" });
  else if (confirmPassword !== password) {
    issues.push({ key: "confirmPassword", label: "Bekreft passord", message: "må være identisk med passordet" });
  }
  return issues;
}

function ValidationSummary({ issues }) {
  if (issues.length === 0) return null;
  return (
    <section className="membership-alert membership-error membership-validation-summary" role="alert">
      <strong>Ugyldig/ikke fylt inn:</strong>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.key}-${index}`}>{issue.label} – {issue.message}</li>
        ))}
      </ul>
    </section>
  );
}

function membershipActivationPath(value) {
  const activationUrl = new URL(value, window.location.origin);
  const tokenFromQuery = activationUrl.searchParams.get("aktiver");
  const minorTokenFromQuery = activationUrl.searchParams.get("aktiver-mindreaarig");
  const tokenFromPath = activationUrl.pathname.match(/\/gift\/activate\/([^/]+)$/)?.[1];
  const token = tokenFromQuery || minorTokenFromQuery || tokenFromPath;
  if (!token || !/^[A-Za-z0-9_-]{30,60}$/.test(token)) {
    throw new Error("Backend returnerte en ugyldig aktiveringslenke.");
  }
  return minorTokenFromQuery
    ? `/medlemskap?aktiver-mindreaarig=${encodeURIComponent(token)}`
    : `/medlemskap?aktiver=${encodeURIComponent(token)}`;
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  optional = false,
  hint,
  placeholder,
  autoComplete,
  fieldKey,
  validationKey,
  validationErrors,
  forceRequired = false,
  forceVisible = false,
  ...props
}) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey || label] || {};
  if (setting.visible === false && !forceVisible) return null;
  const fieldLabel = setting.label || label;
  const fieldRequired = forceRequired || (setting.required ?? required);
  const fieldPlaceholder = setting.placeholder ?? placeholder;
  const validationMessage = (validationErrors || formConfig?.validationErrors)?.[validationKey || fieldKey || label];
  return (
    <label className={`membership-field${validationMessage ? " membership-field-invalid" : ""}`}>
      <span>{fieldLabel}{optional && " (valgfritt)"}{fieldRequired && <span aria-hidden="true"> *</span>}</span>
      <input
        name={name || fieldKey || label}
        type={type}
        {...(type === "file" ? {} : { value: value ?? "" })}
        onChange={onChange}
        required={fieldRequired}
        aria-invalid={Boolean(validationMessage)}
        placeholder={fieldPlaceholder}
        autoComplete={autoComplete}
        {...props}
      />
      {hint && <small className="membership-field-hint">{hint}</small>}
      {validationMessage && <small className="membership-validation-message">{validationMessage}</small>}
    </label>
  );
}

function TextAreaField({ label, fieldKey, value, onChange, rows = 4, required = false, validationErrors, validationKey = fieldKey }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey] || {};
  if (setting.visible === false) return null;
  const fieldRequired = setting.required ?? required;
  const validationMessage = (validationErrors || formConfig?.validationErrors)?.[validationKey];
  return (
    <label className={`membership-field membership-grid-wide${validationMessage ? " membership-field-invalid" : ""}`}>
      <span>{setting.label || label}{fieldRequired && <span aria-hidden="true"> *</span>}</span>
      <textarea rows={rows} value={value ?? ""} onChange={onChange} required={fieldRequired} aria-invalid={Boolean(validationMessage)} placeholder={setting.placeholder ?? label} />
      {validationMessage && <small className="membership-validation-message">{validationMessage}</small>}
    </label>
  );
}

function CheckField({ label, fieldKey, checked, onChange, required = false, forceRequired = false, forceVisible = false, validationErrors, validationKey = fieldKey }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey] || {};
  if (setting.visible === false && !forceVisible) return null;
  const fieldRequired = forceRequired || (setting.required ?? required);
  const validationMessage = (validationErrors || formConfig?.validationErrors)?.[validationKey];
  return (
    <label className={`membership-check${validationMessage ? " membership-check-invalid" : ""}`}>
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} required={fieldRequired} aria-invalid={Boolean(validationMessage)} />
      {setting.label || label}
      {fieldRequired && <span aria-hidden="true"> *</span>}
      {validationMessage && <small className="membership-validation-message">{validationMessage}</small>}
    </label>
  );
}

function SelectField({ label, value, onChange, options, required = false, fieldKey, forceRequired = false, forceVisible = false, validationErrors, validationKey = fieldKey }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey || label] || {};
  if (setting.visible === false && !forceVisible) return null;
  const isLocalGroupField = fieldKey?.endsWith(".region") || fieldKey?.endsWith(".chapter");
  const fieldOptions = isLocalGroupField ? options : formConfig?.options?.[formConfig.flow]?.[fieldKey || label] || options;
  const fieldRequired = forceRequired || (setting.required ?? required);
  const validationMessage = (validationErrors || formConfig?.validationErrors)?.[validationKey];
  return (
    <label className={`membership-field${validationMessage ? " membership-field-invalid" : ""}`}>
      <span>{setting.label || label}{fieldRequired && <span aria-hidden="true"> *</span>}</span>
      <select value={value ?? ""} onChange={onChange} required={fieldRequired} aria-invalid={Boolean(validationMessage)}>
        <option value="">Velg …</option>
        {fieldOptions.map((option) => (
          <option value={option} key={option}>{option}</option>
        ))}
      </select>
      {validationMessage && <small className="membership-validation-message">{validationMessage}</small>}
    </label>
  );
}

function Section({ title, children, description }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.sections?.[formConfig.flow]?.[title] || {};
  if (setting.visible === false) return null;
  const sectionDescription = Object.hasOwn(setting, "description") ? setting.description : description;
  return (
    <section className="membership-section">
      <h2>{setting.label || title}</h2>
      {sectionDescription && <p className="membership-muted">{sectionDescription}</p>}
      <div className="membership-grid">{children}</div>
    </section>
  );
}

function AddressFields({ value = emptyAddress, onChange, fieldPrefix, validationErrors = {} }) {
  const autocompleteSection = `section-${fieldPrefix.replaceAll(".", "-")}`;
  const updateStreet = (event) => {
    onChange({
      ...value,
      street: event.target.value,
      postalCode: "",
      city: "",
    });
  };
  return (
    <>
      <Field
        label="Gateadresse"
        fieldKey={`${fieldPrefix}.street`}
        value={value.street}
        onChange={updateStreet}
        required
        autoComplete={`${autocompleteSection} address-line1`}
        validationErrors={validationErrors}
      />
      <Field
        label="Postnummer"
        fieldKey={`${fieldPrefix}.postalCode`}
        value={value.postalCode}
        onChange={(event) => onChange({ ...value, postalCode: event.target.value })}
        required
        inputMode="numeric"
        autoComplete={`${autocompleteSection} postal-code`}
        validationErrors={validationErrors}
      />
      <Field
        label="Poststed"
        fieldKey={`${fieldPrefix}.city`}
        value={value.city}
        onChange={(event) => onChange({ ...value, city: event.target.value })}
        required
        autoComplete={`${autocompleteSection} address-level2`}
        validationErrors={validationErrors}
      />
    </>
  );
}

function PersonFields({ title, value, onChange, includeEmail = true, includePhone = true, fieldPrefix, validationPrefix = fieldPrefix, validationErrors, forceRequired = false, forceVisible = false, forceVisibleFields = [], optionalFields = [], loginContactNotes = false, lockedFields = [] }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const isForcedVisible = (key) => forceRequired || forceVisible || lockedFields.includes(key) || forceVisibleFields.includes(key);
  return (
    <Section title={title}>
      <Field label="Fornavn" fieldKey={`${fieldPrefix}.firstName`} validationKey={`${validationPrefix}.firstName`} validationErrors={validationErrors} value={value.firstName} onChange={set("firstName")} required forceRequired={forceRequired || lockedFields.includes("firstName")} forceVisible={isForcedVisible("firstName")} autoComplete="given-name" />
      <Field label="Mellomnavn (valgfritt)" fieldKey={`${fieldPrefix}.middleName`} validationKey={`${validationPrefix}.middleName`} validationErrors={validationErrors} value={value.middleName} onChange={set("middleName")} forceVisible={isForcedVisible("middleName")} autoComplete="additional-name" />
      <Field label="Etternavn" fieldKey={`${fieldPrefix}.lastName`} validationKey={`${validationPrefix}.lastName`} validationErrors={validationErrors} value={value.lastName} onChange={set("lastName")} required forceRequired={forceRequired || lockedFields.includes("lastName")} forceVisible={isForcedVisible("lastName")} autoComplete="family-name" />
      <SelectField label="Kjønn" fieldKey={`${fieldPrefix}.gender`} validationKey={`${validationPrefix}.gender`} validationErrors={validationErrors} value={value.gender} onChange={set("gender")} options={["Mann", "Kvinne", "Annet"]} required forceRequired={forceRequired || lockedFields.includes("gender")} forceVisible={isForcedVisible("gender")} />
      {includeEmail && <Field label="E-post" fieldKey={`${fieldPrefix}.email`} validationKey={`${validationPrefix}.email`} validationErrors={validationErrors} type="email" value={value.email} onChange={set("email")} required optional={optionalFields.includes("email")} forceRequired={forceRequired || lockedFields.includes("email")} forceVisible={isForcedVisible("email")} hint={loginContactNotes ? "NB: Denne e-posten vil brukes til innlogging" : undefined} autoComplete="email" />}
      {includePhone && <Field label="Telefonnummer" fieldKey={`${fieldPrefix}.phone`} validationKey={`${validationPrefix}.phone`} validationErrors={validationErrors} type="tel" value={value.phone} onChange={set("phone")} required optional={optionalFields.includes("phone")} forceRequired={forceRequired || lockedFields.includes("phone")} forceVisible={isForcedVisible("phone")} hint={loginContactNotes ? "NB: Dette telefonnummeret vil brukes til innlogging" : undefined} autoComplete="tel" />}
    </Section>
  );
}

function LocalGroupFields({ config, region, chapter, onChange, optional = false, fieldPrefix, validationErrors }) {
  const regions = config?.regions || [];
  const selectedRegion = regions.find((item) => item.name === region);
  const chapters = selectedRegion?.chapters || [];
  return (
    <Section title="Velg lokallag" description={optional ? "Valgfritt ved kjøp. Mottakeren kan velge dette senere." : undefined}>
      <SelectField
        label="Region"
        fieldKey={`${fieldPrefix}.region`}
        value={region}
        onChange={(event) => onChange(event.target.value, "")}
        options={regions.map((item) => item.name)}
        required={!optional}
        validationErrors={validationErrors}
      />
      <SelectField
        label="Lokallag"
        fieldKey={`${fieldPrefix}.chapter`}
        value={chapter}
        onChange={(event) => onChange(region, event.target.value)}
        options={chapters}
        required={Boolean(region)}
        forceRequired={Boolean(region)}
        validationErrors={validationErrors}
      />
    </Section>
  );
}

function PasswordFields({ password, confirmPassword, onChange, fieldPrefix, validationErrors }) {
  const passwordKey = fieldPrefix ? `${fieldPrefix}.password` : "password";
  const confirmationKey = fieldPrefix ? `${fieldPrefix}.confirmPassword` : "confirmPassword";
  return (
    <Section title="Passord">
      <Field label="Passord" fieldKey={passwordKey} type="password" value={password} onChange={(event) => onChange("password", event.target.value)} required forceRequired forceVisible minLength={12} maxLength={200} autoComplete="new-password" validationErrors={validationErrors} />
      <Field label="Bekreft passord" fieldKey={confirmationKey} type="password" value={confirmPassword} onChange={(event) => onChange("confirmPassword", event.target.value)} required forceRequired forceVisible minLength={12} maxLength={200} autoComplete="new-password" validationErrors={validationErrors} />
      <p className="membership-note membership-grid-wide">Passordet må være minst 12 tegn. Bekreftelsen må være identisk.</p>
    </Section>
  );
}

function Message({ error, success }) {
  if (error) return <p className="membership-alert membership-error" role="alert">{error}</p>;
  if (success) return <p className="membership-alert membership-success" role="status">{success}</p>;
  return null;
}

function DynamicFormFields({ fields, values, onChange, validationErrors }) {
  const formConfig = useContext(FormConfigContext);
  const errors = validationErrors || formConfig?.validationErrors || {};
  return fields.map((field) => {
    if (field.type === "section") {
      return (
        <section className="membership-section" key={field.id}>
          <h2>{field.label}</h2>
          {field.content && <p className="membership-muted">{field.content}</p>}
        </section>
      );
    }
    if (field.type === "checkbox") {
      const validationMessage = errors[field.id];
      return (
        <label className={`membership-check${validationMessage ? " membership-check-invalid" : ""}`} key={field.id}>
          <input
            type="checkbox"
            checked={Boolean(values[field.id])}
            onChange={(event) => onChange(field.id, event.target.checked)}
            required={field.required}
            aria-invalid={Boolean(validationMessage)}
          />
          {field.label}{field.required && <span aria-hidden="true"> *</span>}
          {validationMessage && <small className="membership-validation-message">{validationMessage}</small>}
        </label>
      );
    }
    if (field.type === "file") {
      return (
        <Field
          key={field.id}
          fieldKey={field.id}
          label={field.label}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          onChange={(event) => onChange(field.id, Array.from(event.target.files || []))}
          required={field.required}
          validationErrors={errors}
        />
      );
    }
    if (field.type === "select") {
      return (
        <SelectField
          key={field.id}
          fieldKey={field.id}
          label={field.label}
          value={values[field.id]}
          onChange={(event) => onChange(field.id, event.target.value)}
          options={field.options || []}
          required={field.required}
          validationErrors={errors}
        />
      );
    }
    if (field.type === "textarea") {
      return (
        <TextAreaField
          key={field.id}
          fieldKey={field.id}
          label={field.label}
          value={values[field.id]}
          onChange={(event) => onChange(field.id, event.target.value)}
          rows={4}
          required={field.required}
          validationErrors={errors}
        />
      );
    }
    const type = field.type === "email" ? "email"
      : field.type === "phone" ? "tel"
        : field.type === "date" ? "date" : "text";
    return (
      <Field
        key={field.id}
        fieldKey={field.id}
        label={field.label}
        type={type}
        value={values[field.id]}
        onChange={(event) => onChange(field.id, event.target.value)}
        required={field.required}
        validationErrors={errors}
      />
    );
  });
}

function CustomFormSubmission({ form }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const validationIssues = validationAttempted ? validateCustomForm(form.fields, values) : [];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult("");
    setValidationAttempted(true);
    if (validateCustomForm(form.fields, values).length > 0) return;
    setBusy(true);
    try {
      const fileFields = form.fields.filter((field) => field.type === "file");
      const payload = Object.fromEntries(
        Object.entries(values).filter(([id]) => !fileFields.some((field) => field.id === id))
      );
      let body = JSON.stringify(payload);
      if (fileFields.some((field) => values[field.id]?.length)) {
        body = new FormData();
        body.append("application", JSON.stringify(payload));
        for (const field of fileFields) {
          for (const file of values[field.id] || []) body.append(`file_${field.id}`, file);
        }
      }
      const response = await request(`/membership/custom/${encodeURIComponent(form.id)}`, {
        method: "POST",
        body,
      });
      setResult(response.message || "Skjemaet er sendt inn.");
      setValues({});
      setValidationAttempted(false);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="membership-form" onSubmit={submit} noValidate>
      <section className="membership-section">
        <h2>{form.name}</h2>
        {form.description && <p className="membership-muted">{form.description}</p>}
        <div className="membership-grid">
          <DynamicFormFields
            fields={form.fields}
            values={values}
            validationErrors={validationErrors}
            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          />
        </div>
      </section>
      <Message error={error} success={result} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy}>
        {busy ? "Sender …" : "Send inn"}
      </button>
    </form>
  );
}

function RegistrationForms({ type, config }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const defaults = useMemo(() => ({
    regular: { ...emptyPerson, birthDate: "", password: "", confirmPassword: "", address: { ...emptyAddress }, region: "", chapter: "" },
    minor: { child: { ...emptyPerson, birthDate: "" }, parents: [{ ...emptyPerson }], address: { ...emptyAddress }, region: "", chapter: "", consent: false },
    gift: { purchaser: { ...emptyPerson, birthDate: "", address: { ...emptyAddress } }, recipient: { ...emptyPerson, birthDate: "", address: { ...emptyAddress } }, guardian: { ...emptyPerson }, consent: false, region: "", chapter: "" },
    craft: { business: { name: "", organizationNumber: "", address: { ...emptyAddress }, phone: "", email: "", website: "" }, applicant: { ...emptyPerson, birthDate: "", address: { ...emptyAddress } }, craftType: "", admissionMethod: "", jury: {}, region: "", chapter: "", criteriaAccepted: false },
  }), []);
  const form = { ...defaults[type], ...values };
  const giftRecipientAge = type === "gift" ? getAge(form.recipient.birthDate) : null;
  const [result, setResult] = useState("");
  const [activationUrl, setActivationUrl] = useState("");
  const validationIssues = validationAttempted ? validateRegistration(type, form, config) : [];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  const setForm = (patch) => setValues((current) => ({ ...current, ...patch }));
  const setNested = (key, patch) => setForm({ [key]: { ...form[key], ...patch } });
  const changeGroup = (region, chapter) => setForm({ region, chapter });

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult("");
    setValidationAttempted(true);
    if (validateRegistration(type, form, config).length > 0) return;
    setBusy(true);
    try {
      let payload = { ...form };
      delete payload.confirmPassword;
      let body;
      if (type === "craft") {
        const { files, ...application } = payload;
        body = new FormData();
        body.append("application", JSON.stringify(application));
        for (const file of files || []) body.append("files", file);
      } else {
        body = JSON.stringify(payload);
      }
      const path = {
        regular: "/membership/regular",
        minor: "/membership/minor",
        gift: "/membership/gift",
        craft: "/membership/craft",
      }[type];
      const data = await request(path, { method: "POST", body });
      setResult(data.message || "Skjemaet er sendt inn.");
      setValidationAttempted(false);
      if (data.activationUrl) setActivationUrl(membershipActivationPath(data.activationUrl));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const address = (key, label, fieldPrefix) => (
    <Section title={label}>
      <AddressFields
        value={getPath(form, key) || { ...emptyAddress }}
        onChange={(value) => setValues((current) => setPath({ ...defaults[type], ...current }, key, value))}
        fieldPrefix={fieldPrefix}
      />
    </Section>
  );
  const password = <PasswordFields password={form.password} confirmPassword={form.confirmPassword} onChange={(key, value) => setForm({ [key]: value })} />;
  const admissionSetting = config?.fields?.craft?.admissionMethod || {};
  const admissionChoices = config?.options?.craft?.admissionMethod || ["certificate", "jury"];

  return (
    <FormConfigContext.Provider value={{ ...config, flow: type, validationErrors }}>
    <form className="membership-form" onSubmit={submit} noValidate>
      {type === "regular" && <>
        <Section title="Alderskontroll">
          <Field label="Fødselsdato" fieldKey="birthDate" type="date" value={form.birthDate} onChange={(event) => setForm({ birthDate: event.target.value })} required forceRequired forceVisible />
          <p className="membership-note">Du må være 18 år eller eldre for vanlig medlemskap.</p>
        </Section>
        <PersonFields title="Personlig informasjon" fieldPrefix="person" value={form} onChange={setForm} lockedFields={["email", "phone"]} />
        {password}
        {address("address", "Adresse", "address")}
        <LocalGroupFields config={config} fieldPrefix="localGroup" region={form.region} chapter={form.chapter} onChange={changeGroup} />
      </>}

      {type === "minor" && <>
        <PersonFields title="Barnets informasjon" fieldPrefix="child" value={form.child} onChange={(child) => setForm({ child })} forceVisibleFields={["email", "phone"]} loginContactNotes />
        <Section title="Barnets alder">
          <Field label="Barnets fødselsdato" fieldKey="child.birthDate" type="date" value={form.child.birthDate} onChange={(event) => setNested("child", { birthDate: event.target.value })} required forceRequired forceVisible />
          <p className="membership-note">Barnet må være under 18 år.</p>
        </Section>
        {form.parents.map((parent, index) => (
          <div className="membership-parent" key={index}>
            <PersonFields title={index === 0 ? "Forelders informasjon" : `Forelder ${index + 1}`} fieldPrefix="parent" validationPrefix={`parents.${index}`} value={parent} onChange={(updated) => setForm({ parents: form.parents.map((item, i) => i === index ? updated : item) })} lockedFields={["firstName", "lastName", "gender", "email", "phone"]} />
            {index > 0 && <button className="membership-text-button" type="button" onClick={() => setForm({ parents: form.parents.filter((_, i) => i !== index) })}>Fjern denne forelderen</button>}
          </div>
        ))}
        <button className="membership-secondary" type="button" onClick={() => setForm({ parents: [...form.parents, { ...emptyPerson }] })}>Legg til en forelder</button>
        {address("address", "Adresse", "address")}
        <LocalGroupFields config={config} fieldPrefix="localGroup" region={form.region} chapter={form.chapter} onChange={changeGroup} />
        <CheckField fieldKey="consent" label="Jeg bekrefter at foresatt har gitt samtykke." checked={form.consent} onChange={(event) => setForm({ consent: event.target.checked })} required forceRequired forceVisible />
      </>}

      {type === "gift" && <>
        <Section title="Kjøperens alderskontroll">
          <Field label="Kjøperens fødselsdato" fieldKey="purchaser.birthDate" type="date" value={form.purchaser.birthDate} onChange={(event) => setNested("purchaser", { birthDate: event.target.value })} required forceRequired forceVisible />
          <p className="membership-note">Kjøperen må være 18 år eller eldre.</p>
        </Section>
        <PersonFields title="Kjøperens personlige informasjon" fieldPrefix="purchaser" value={form.purchaser} onChange={(purchaser) => setNested("purchaser", purchaser)} lockedFields={["email", "phone"]} />
        {address("purchaser.address", "Kjøperens adresse", "purchaser.address")}
        <Section title="Mottakerens alderskontroll">
          <Field label="Mottakerens fødselsdato" fieldKey="recipient.birthDate" type="date" value={form.recipient.birthDate} onChange={(event) => setNested("recipient", { birthDate: event.target.value })} required forceRequired forceVisible />
        </Section>
        <PersonFields title="Mottakerens personlige informasjon" fieldPrefix="recipient" value={form.recipient} onChange={(recipient) => setNested("recipient", recipient)} lockedFields={["email", "phone"]} />
        {address("recipient.address", "Mottakerens adresse", "recipient.address")}
        {giftRecipientAge !== null && giftRecipientAge < 18 && <>
          <p className="membership-note">Mottakeren er under 18 år. Oppgi foresattens informasjon og bekreft foresattsamtykke.</p>
          <PersonFields
            title="Foresattens informasjon"
            fieldPrefix="guardian"
            value={form.guardian}
            onChange={(guardian) => setNested("guardian", guardian)}
            forceRequired
            forceVisible
          />
          <CheckField
            fieldKey="consent"
            label="Jeg bekrefter at foresatt har gitt samtykke til medlemskapet."
            checked={form.consent}
            onChange={(event) => setForm({ consent: event.target.checked })}
            required
            forceRequired
            forceVisible
          />
        </>}
        <LocalGroupFields config={config} fieldPrefix="localGroup" region={form.region} chapter={form.chapter} onChange={changeGroup} optional />
        <p className="membership-note">Betaling og e-postutsending er ikke koblet til denne lokale utviklingsversjonen. Etter innsending får du en aktiveringslenke som må deles sikkert med mottakeren.</p>
      </>}

      {type === "craft" && <>
        <Section title="Bedriftsinformasjon" description="Bedriften må ha minst én ansatt med svennebrev, tilsvarende utdanning eller høyere håndverksutdanning.">
          <Field label="Bedriftsnavn" fieldKey="business.name" value={form.business.name} onChange={(event) => setNested("business", { name: event.target.value })} required />
          <Field label="Organisasjonsnummer" fieldKey="business.organizationNumber" value={form.business.organizationNumber} onChange={(event) => setNested("business", { organizationNumber: event.target.value })} required inputMode="numeric" />
          <Field label="Telefon" fieldKey="business.phone" type="tel" value={form.business.phone} onChange={(event) => setNested("business", { phone: event.target.value })} required />
          <Field label="E-post" fieldKey="business.email" type="email" value={form.business.email} onChange={(event) => setNested("business", { email: event.target.value })} required />
          <Field label="Hjemmeside (valgfritt)" fieldKey="business.website" type="url" value={form.business.website} onChange={(event) => setNested("business", { website: event.target.value })} />
        </Section>
        <CheckField fieldKey="business.qualificationConfirmed" label="Jeg bekrefter at minst én ansatt i bedriften har svennebrev, tilsvarende utdanning eller høyere håndverksutdanning." checked={form.business.qualificationConfirmed} onChange={(event) => setNested("business", { qualificationConfirmed: event.target.checked })} required forceRequired forceVisible />
        {address("business.address", "Bedriftens adresse", "business.address")}
        <PersonFields title="Søkerens personinformasjon" fieldPrefix="applicant" value={form.applicant} onChange={(applicant) => setNested("applicant", applicant)} lockedFields={["email", "phone"]} />
        <Section title="Søkerens fødselsdato og adresse">
          <Field label="Fødselsdato" fieldKey="applicant.birthDate" type="date" value={form.applicant.birthDate} onChange={(event) => setNested("applicant", { birthDate: event.target.value })} required forceRequired forceVisible />
          <p className="membership-note">Søkeren må være 18 år eller eldre.</p>
        </Section>
        {address("applicant.address", "Søkerens adresse", "applicant.address")}
        <Section title="Håndverkstype">
          <SelectField label="Velg håndverkstype" fieldKey="craftType" value={form.craftType} onChange={(event) => setForm({ craftType: event.target.value })} required options={["Tekstil", "Skinn og lær", "Tre", "Kurvmaker", "Metall", "Knivmaker", "Keramikk", "Smykker", "Glass", "Duodji", "Rose- og dekormaling", "Annet"]} />
        </Section>
        {admissionSetting.visible !== false && (
          <Section title={admissionSetting.label || "Vurdering av søknad"}>
            {admissionChoices.includes("certificate") && <label className={`membership-check${validationErrors.admissionMethod ? " membership-check-invalid" : ""}`}><input type="radio" name="admissionMethod" value="certificate" required aria-invalid={Boolean(validationErrors.admissionMethod)} checked={form.admissionMethod === "certificate"} onChange={() => setForm({ admissionMethod: "certificate" })} /> Automatisk opptak med svennebrev/fagbrev</label>}
            {admissionChoices.includes("jury") && <label className={`membership-check${validationErrors.admissionMethod ? " membership-check-invalid" : ""}`}><input type="radio" name="admissionMethod" value="jury" required aria-invalid={Boolean(validationErrors.admissionMethod)} checked={form.admissionMethod === "jury"} onChange={() => setForm({ admissionMethod: "jury" })} /> Juryert opptak: egenportefølje</label>}
            {validationErrors.admissionMethod && <small className="membership-validation-message">{validationErrors.admissionMethod}</small>}
          </Section>
        )}
        {form.admissionMethod === "certificate" && (
          <Section title="Last opp dokumentasjon">
            <Field label="Svennebrev/fagbrev (PDF eller bilde)" fieldKey="files" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setForm({ files: Array.from(event.target.files || []) })} required forceRequired forceVisible />
          </Section>
        )}
        {form.admissionMethod === "jury" && <>
          <Section title="Juryert opptak" description="Fyll ut feltene og send et representativt utvalg produkter som viser den faglige kompetansen. Send i tillegg inn 3–5 produkter.">
            <Field label="Produktbilder (PDF eller bilder)" fieldKey="files" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={(event) => setForm({ files: Array.from(event.target.files || []) })} required forceRequired forceVisible />
            {["education", "practice", "exhibitions", "awards", "materials", "formColorDecoration", "technique", "use", "originality", "photographs"].map((key) => {
              const labels = {
                education: "Relevant utdanning / realkompetanse",
                practice: "Relevant praksis",
                exhibitions: "Deltagelse på nasjonale juryerte utstillinger",
                awards: "Mottatt designpris eller lignende på nasjonalt/regionalt nivå",
                materials: "Materialer",
                formColorDecoration: "Form, farge og dekor",
                technique: "Fremstillingsteknikk",
                use: "Bruksområde",
                originality: "Originalitet",
                photographs: "Vedlagte fotografier viser",
              };
              return <TextAreaField key={key} fieldKey={`jury.${key}`} label={labels[key]} value={form.jury[key]} onChange={(event) => setNested("jury", { [key]: event.target.value })} />;
            })}
          </Section>
          <p className="membership-note">{config?.craftShippingInstructions || "Informasjon om hvor produktene skal sendes er ikke satt av administrator ennå."}</p>
        </>}
        <LocalGroupFields config={config} fieldPrefix="localGroup" region={form.region} chapter={form.chapter} onChange={changeGroup} optional />
        <CheckField fieldKey="criteriaAccepted" label="Jeg har forstått medlemskriteriene for Norske Husflidshåndverkere i Norges Husflidslag." checked={form.criteriaAccepted} onChange={(event) => setForm({ criteriaAccepted: event.target.checked })} required forceRequired forceVisible />
      </>}

      <DynamicFormFields
        fields={config?.additionalFields?.[type] || []}
        values={form}
        onChange={(id, value) => setForm({ [id]: value })}
      />

      <Message error={error} success={result} />
      {activationUrl && <p className="membership-alert membership-success">
        {type === "minor"
          ? <>Del denne lenken privat med den foresatte, slik at barnet kan registrere innloggingen sin:{" "}<a href={activationUrl}>Registrer bruker for mindreårig</a></>
          : <>Del denne lenken privat med mottakeren: <a href={activationUrl}>Mottatt medlemskap? Trykk her</a></>}
      </p>}
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" type="submit" disabled={busy}>
        {busy ? "Sender …" : type === "gift" ? "Send inn gavekjøp" : type === "craft" ? "Send søknad" : "Registrer medlemskap"}
      </button>
    </form>
    </FormConfigContext.Provider>
  );
}

function GiftActivation({ config, token, identifier, activationInfo }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [region, setRegion] = useState(activationInfo.localGroup?.region || "");
  const [chapter, setChapter] = useState(activationInfo.localGroup?.chapter || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const passwordIssues = validationAttempted ? validatePasswordSetup(password, confirmPassword) : [];
  const groupIssues = validationAttempted && !activationInfo?.groupSelected && config.regions?.length > 0
    ? [
      ...(!region ? [{ key: "localGroup.region", label: "Region", message: "må fylles inn" }] : []),
      ...(region && !chapter ? [{ key: "localGroup.chapter", label: "Lokallag", message: "må fylles inn" }] : []),
    ]
    : [];
  const validationIssues = [...passwordIssues, ...groupIssues];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  async function activate(event) {
    event.preventDefault();
    setError("");
    setValidationAttempted(true);
    if (validatePasswordSetup(password, confirmPassword).length > 0 ||
        (!activationInfo?.groupSelected && config.regions?.length > 0 && (!region || !chapter))) return;
    setBusy(true);
    try {
      const data = await request(`/membership/gift/activate/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({
          identifier,
          password,
          ...(!activationInfo?.groupSelected ? { region, chapter } : {}),
        }),
      });
      setSuccess(data.message || "Medlemskapet er aktivert.");
    } catch (activationError) {
      setError(activationError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="membership-form" onSubmit={activate} noValidate>
      <h2>Aktiver mottatt medlemskap</h2>
      <p>Opprett et passord for medlemskontoen.</p>
      <PasswordFields password={password} confirmPassword={confirmPassword} onChange={(key, value) => key === "password" ? setPassword(value) : setConfirmPassword(value)} validationErrors={validationErrors} />
      {activationInfo?.groupSelected
        ? <p className="membership-note">Lokallag valgt ved kjøpet: {region} — {chapter}</p>
        : config.regions?.length > 0 && <LocalGroupFields config={config} fieldPrefix="localGroup" region={region} chapter={chapter} onChange={(r, c) => { setRegion(r); setChapter(c); }} validationErrors={validationErrors} />}
      <Message error={error} success={success} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy || !activationInfo}>{busy ? "Aktiverer …" : "Aktiver medlemskap"}</button>
    </form>
  );
}

function GiftActivationEntry({ config, initialToken = "" }) {
  return <ActivationFlow type="gift" config={config} initialToken={initialToken} />;
}

function GiftActivationCodeEntry({ onSubmit, code, setCode, error, busy, validationErrors = {}, validationIssues = [] }) {
  return (
    <form className="membership-form" onSubmit={onSubmit} noValidate>
      <section className="membership-section">
        <h2>Bekreft medlemskapet</h2>
        <p>Kontaktinformasjonen er registrert. Lim inn den personlige aktiveringslenken eller koden du mottok for å fortsette.</p>
        <label className={`membership-field${validationErrors.code ? " membership-field-invalid" : ""}`}>
          <span>Aktiveringslenke eller kode</span>
          <input type="text" autoComplete="url" value={code} onChange={(event) => setCode(event.target.value)} required aria-invalid={Boolean(validationErrors.code)} />
        </label>
      </section>
      <Message error={error} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy}>{busy ? "Kontrollerer …" : "Fortsett"}</button>
    </form>
  );
}

export function GiftActivationEntryLegacy() {
  const navigate = useNavigate();
  const [activationValue, setActivationValue] = useState("");
  const [error, setError] = useState("");

  function continueToActivation(event) {
    event.preventDefault();
    setError("");
    let token = activationValue.trim();
    try {
      const activationUrl = new URL(token, window.location.origin);
      token = activationUrl.searchParams.get("aktiver") ||
        activationUrl.pathname.match(/\/gift\/activate\/([^/]+)$/)?.[1] ||
        token;
    } catch {
      // The input may be the token itself rather than a URL.
    }
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) {
      setError("Lim inn den personlige aktiveringslenken eller koden du mottok.");
      return;
    }
    navigate(`/medlemskap?aktiver=${encodeURIComponent(token)}`);
  }

  return (
    <form className="membership-form" onSubmit={continueToActivation}>
      <section className="membership-section">
        <h2>Aktiver mottatt medlemskap</h2>
        <p>Lim inn den personlige aktiveringslenken eller koden du mottok.</p>
        <label className="membership-field">
          <span>Aktiveringslenke eller kode</span>
          <input
            type="text"
            autoComplete="url"
            value={activationValue}
            onChange={(event) => setActivationValue(event.target.value)}
            required
          />
        </label>
      </section>
      <Message error={error} />
      <button className="membership-submit">Fortsett</button>
    </form>
  );
}

export function MinorAccountSetupEntryLegacy() {
  const navigate = useNavigate();
  const [activationValue, setActivationValue] = useState("");
  const [error, setError] = useState("");

  function continueToSetup(event) {
    event.preventDefault();
    setError("");
    let token = activationValue.trim();
    try {
      const activationUrl = new URL(token, window.location.origin);
      token = activationUrl.searchParams.get("aktiver-mindreaarig") ||
        activationUrl.pathname.match(/\/minor\/activate\/([^/]+)$/)?.[1] ||
        token;
    } catch {
      // The input may be the token itself rather than a URL.
    }
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) {
      setError("Lim inn aktiveringslenken eller koden som ble delt etter registreringen.");
      return;
    }
    navigate(`/medlemskap?aktiver-mindreaarig=${encodeURIComponent(token)}`);
  }

  return (
    <form className="membership-form" onSubmit={continueToSetup}>
      <section className="membership-section">
        <h2>Registrer bruker for mindreårig</h2>
        <p>Lim inn aktiveringslenken eller koden som ble delt etter registreringen.</p>
        <label className="membership-field">
          <span>Aktiveringslenke eller kode</span>
          <input
            type="text"
            autoComplete="url"
            value={activationValue}
            onChange={(event) => setActivationValue(event.target.value)}
            required
          />
        </label>
      </section>
      <Message error={error} />
      <button className="membership-submit">Fortsett</button>
    </form>
  );
}

function MinorAccountSetupEntry({ config, initialToken = "" }) {
  return <ActivationFlow type="minor" config={config} initialToken={initialToken} />;
}

function MinorAccountSetup({ token, identifier }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const validationIssues = validationAttempted ? validatePasswordSetup(password, confirmPassword) : [];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setValidationAttempted(true);
    if (validatePasswordSetup(password, confirmPassword).length > 0) return;
    setBusy(true);
    try {
      const result = await request(`/membership/minor/activate/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      setSuccess(result.message || "Innloggingen for barnet er registrert.");
      setPassword("");
      setConfirmPassword("");
      setValidationAttempted(false);
    } catch (setupError) {
      setError(setupError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="membership-form" onSubmit={submit} noValidate>
      <h2>Registrer bruker for mindreårig</h2>
      <p>Velg passordet barnet skal bruke sammen med den registrerte e-postadressen.</p>
      <section className="membership-section">
        <label className="membership-field">
          <span>Passord</span>
          <input type="password" autoComplete="new-password" minLength={12} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} required aria-invalid={Boolean(validationErrors.password)} />
          {validationErrors.password && <small className="membership-validation-message">{validationErrors.password}</small>}
        </label>
        <label className="membership-field">
          <span>Bekreft passord</span>
          <input type="password" autoComplete="new-password" minLength={12} maxLength={200} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required aria-invalid={Boolean(validationErrors.confirmPassword)} />
          {validationErrors.confirmPassword && <small className="membership-validation-message">{validationErrors.confirmPassword}</small>}
        </label>
      </section>
      <Message error={error} success={success} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy}>{busy ? "Lagrer …" : "Lagre innlogging"}</button>
    </form>
  );
}

export function CraftAccountSetupEntryLegacy() {
  const navigate = useNavigate();
  const [activationValue, setActivationValue] = useState("");
  const [error, setError] = useState("");

  function continueToSetup(event) {
    event.preventDefault();
    setError("");
    let token = activationValue.trim();
    try {
      const activationUrl = new URL(token, window.location.origin);
      token = activationUrl.searchParams.get("aktiver-haandverker") ||
        activationUrl.pathname.match(/\/craft\/activate\/([^/]+)$/)?.[1] ||
        token;
    } catch {
      // The input may be the token itself rather than a URL.
    }
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) {
      setError("Lim inn aktiveringslenken du fikk etter at søknaden ble godkjent.");
      return;
    }
    navigate(`/medlemskap?aktiver-haandverker=${encodeURIComponent(token)}`);
  }

  return (
    <form className="membership-form" onSubmit={continueToSetup}>
      <section className="membership-section">
        <h2>Opprett passord for husflidshåndverker</h2>
        <p>Lim inn den personlige aktiveringslenken du fikk etter at søknaden ble godkjent.</p>
        <label className="membership-field">
          <span>Aktiveringslenke eller kode</span>
          <input type="text" autoComplete="url" value={activationValue} onChange={(event) => setActivationValue(event.target.value)} required />
        </label>
      </section>
      <Message error={error} />
      <button className="membership-submit">Fortsett</button>
    </form>
  );
}

function CraftAccountSetupEntry({ config, initialToken = "" }) {
  return <ActivationFlow type="craft" config={config} initialToken={initialToken} />;
}

function CraftAccountSetup({ token, identifier }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const validationIssues = validationAttempted ? validatePasswordSetup(password, confirmPassword) : [];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setValidationAttempted(true);
    if (validatePasswordSetup(password, confirmPassword).length > 0) return;
    setBusy(true);
    try {
      const result = await request(`/membership/craft/activate/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      setSuccess(`${result.message || "Husflidshåndverker-medlemskapet er aktivert."} Du kan nå logge inn med e-postadressen fra søknaden.`);
      setPassword("");
      setConfirmPassword("");
      setValidationAttempted(false);
    } catch (activationError) {
      setError(activationError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="membership-form" onSubmit={submit} noValidate>
      <h2>Opprett passord for husflidshåndverker</h2>
      <p>Velg passordet du vil bruke når du logger inn med e-postadressen fra søknaden.</p>
      <PasswordFields
        password={password}
        confirmPassword={confirmPassword}
        onChange={(key, value) => key === "password" ? setPassword(value) : setConfirmPassword(value)}
        validationErrors={validationErrors}
      />
      <Message error={error} success={success} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy}>{busy ? "Lagrer …" : "Lagre passord"}</button>
    </form>
  );
}

const activationTypes = {
  gift: {
    query: "aktiver",
    title: "Aktiver mottatt medlemskap",
    path: (token) => `/membership/gift/activate/${encodeURIComponent(token)}`,
  },
  minor: {
    query: "aktiver-mindreaarig",
    title: "Registrer bruker for mindreårig",
    path: (token) => `/membership/minor/activate/${encodeURIComponent(token)}`,
  },
  craft: {
    query: "aktiver-haandverker",
    title: "Opprett passord for husflidshåndverker",
    path: (token) => `/membership/craft/activate/${encodeURIComponent(token)}`,
  },
};

function activationTokenFrom(value, type) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed, window.location.origin);
    const queryToken = url.searchParams.get(activationTypes[type].query);
    const pathToken = url.pathname.match(/\/(?:gift|minor|craft)\/activate\/([^/]+)$/)?.[1];
    if (queryToken || pathToken) return queryToken || pathToken;
  } catch {
    // The value may be the token rather than a URL.
  }
  return trimmed;
}

function ActivationFlow({ type, config, initialToken = "" }) {
  const flow = activationTypes[type];
  const [step, setStep] = useState("contact");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState(initialToken);
  const [token, setToken] = useState("");
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const contactIssues = validationAttempted && step === "contact"
    ? !identifier.trim()
      ? [{ key: "identifier", label: "E-post eller telefonnummer", message: "må fylles inn" }]
      : !validEmail(identifier.trim()) && !validPhone(identifier.trim())
        ? [{ key: "identifier", label: "E-post eller telefonnummer", message: "må være en gyldig e-postadresse eller et telefonnummer" }]
        : []
    : [];
  const candidateCode = activationTokenFrom(code, type);
  const codeIssues = validationAttempted && step === "code" &&
      !/^[A-Za-z0-9_-]{30,60}$/.test(candidateCode)
    ? [{ key: "code", label: "Aktiveringslenke eller kode", message: "lim inn en gyldig aktiveringslenke eller kode" }]
    : [];
  const validationIssues = step === "contact" ? contactIssues : codeIssues;
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  async function checkContact(event) {
    event.preventDefault();
    setError("");
    setValidationAttempted(true);
    if (!identifier.trim() || (!validEmail(identifier.trim()) && !validPhone(identifier.trim()))) return;
    setBusy(true);
    try {
      await request("/membership/activation/lookup", {
        method: "POST",
        body: JSON.stringify({ type, identifier }),
      });
      setStep("code");
      setValidationAttempted(false);
    } catch (lookupError) {
      setError(lookupError.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(event) {
    event.preventDefault();
    setError("");
    setValidationAttempted(true);
    const candidate = candidateCode;
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(candidate)) {
      return;
    }
    setBusy(true);
    try {
      const result = await request("/membership/activation/verify", {
        method: "POST",
        body: JSON.stringify({ type, identifier, token: candidate }),
      });
      setToken(candidate);
      setVerification(result);
      setStep("setup");
      setValidationAttempted(false);
    } catch (codeError) {
      setError(codeError.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "contact") return (
    <form className="membership-form" onSubmit={checkContact} noValidate>
      <section className="membership-section">
        <h2>{flow.title}</h2>
        <p>Skriv inn e-postadressen eller telefonnummeret som ble registrert for medlemskapet.</p>
        <label className={`membership-field${validationErrors.identifier ? " membership-field-invalid" : ""}`}>
          <span>E-post eller telefonnummer</span>
          <input type="text" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required aria-invalid={Boolean(validationErrors.identifier)} />
        </label>
      </section>
      <Message error={error} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy}>{busy ? "Kontrollerer …" : "Fortsett"}</button>
    </form>
  );

  if (step === "code") return (
    <GiftActivationCodeEntry
      onSubmit={checkCode}
      code={code}
      setCode={setCode}
      error={error}
      busy={busy}
      validationErrors={validationErrors}
      validationIssues={validationIssues}
    />
  );

  if (type === "gift") {
    return (
      <GiftActivation
        config={config}
        token={token}
        identifier={identifier}
        activationInfo={verification}
      />
    );
  }
  if (type === "minor") return <MinorAccountSetup token={token} identifier={identifier} />;
  return <CraftAccountSetup token={token} identifier={identifier} />;
}

export function AdminPanel() {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [authenticated, setAuthenticated] = useState(false);
  const [config, setConfig] = useState(null);
  const [applications, setApplications] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [activationLinks, setActivationLinks] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    request("/auth/me")
      .then(() => Promise.all([
        request("/admin/config"),
        request("/admin/applications"),
      ]))
      .then(([settings, records]) => {
        if (!active) return;
        setAuthenticated(true);
        setConfig(settings.config || settings);
        setApplications(records.applications || []);
      })
      .catch((loadError) => {
        if (active && loadError.status !== 401) setError(loadError.message);
      });
    return () => { active = false; };
  }, []);

  async function login(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
      window.dispatchEvent(new Event("set18-auth-change"));
      const [settings, records] = await Promise.all([
        request("/admin/config"),
        request("/admin/applications"),
      ]);
      setAuthenticated(true);
      setConfig(settings.config || settings);
      setApplications(records.applications || []);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveConfig(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const options = JSON.parse(config.optionsText || "{}");
      if (options === null || Array.isArray(options) || typeof options !== "object") {
        throw new Error("Alternativene må være et JSON-objekt.");
      }
      const regions = config.regionsText.split("\n").map((line) => {
        const [name, ...chapters] = line.split(":");
        return { name: name.trim(), chapters: chapters.join(":").split(",").map((item) => item.trim()).filter(Boolean) };
      }).filter((region) => region.name);
      const fields = config.fields || {};
      const requiredFields = Object.fromEntries(membershipTypes.map(([flow]) => [
        flow,
        Object.entries(fields[flow] || {})
          .filter(([field, setting]) => (setting.required &&
            !(flow === "minor" && field === "password")) ||
            (flow === "minor" && ["child.email", "child.phone"].includes(field)))
          .map(([field]) => field),
      ]));
      requiredFields.minor = [...new Set([
        ...requiredFields.minor,
        "child.email",
        "child.phone",
      ])];
      const payload = { ...config, regions, fields, requiredFields, options };
      delete payload.regionsText;
      delete payload.optionsText;
      const result = await request("/admin/config", { method: "PUT", body: JSON.stringify(payload) });
      setConfig({
        ...payload,
        regionsText: regions.map((item) => `${item.name}: ${item.chapters.join(", ")}`).join("\n"),
        optionsText: JSON.stringify(options, null, 2),
      });
      setSuccess(result.message || "Innstillingene er lagret.");
    } catch (saveError) {
      setError(saveError.message);
    }
  }
  async function logout() {
    try {
      await request("/auth/logout", { method: "POST", body: JSON.stringify({}) });
      setAuthenticated(false);
      setConfig(null);
      window.dispatchEvent(new Event("set18-auth-change"));
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }
  async function reviewApplication(id, status) {
    setError("");
    setSuccess("");
    try {
      const result = await request(`/admin/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note: reviewNotes[id] || "" }),
      });
      if (result.activationUrl) {
        setActivationLinks((current) => ({ ...current, [id]: result.activationUrl }));
      } else if (status === "approved") {
        setActivationLinks((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
      setSuccess(result.message || "Søknaden er oppdatert.");
      const records = await request("/admin/applications");
      setApplications(records.applications || []);
    } catch (reviewError) {
      setError(reviewError.message);
    }
  }

  function updatePresetFields(flow, fields) {
    setConfig({
      ...editableConfig,
      additionalFields: { ...editableConfig.additionalFields, [flow]: fields },
    });
  }

  function updateCustomForms(customForms) {
    setConfig({ ...editableConfig, customForms });
  }

  if (!authenticated) return (
    <form className="membership-form admin-login" onSubmit={login}>
      <h2>Administratorinnlogging</h2>
      <Field label="E-post" type="email" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} required autoComplete="username" />
      <Field label="Passord" type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} required autoComplete="current-password" />
      <Message error={error} />
      <button className="membership-submit" disabled={busy}>{busy ? "Logger inn …" : "Logg inn"}</button>
      <p className="membership-note">Opprett administratorlegitimasjon via miljøvariablene som er dokumentert i backend.</p>
    </form>
  );

  const editableConfig = config && {
    ...config,
    regionsText: config.regionsText || (config.regions || []).map((item) => `${item.name}: ${(item.chapters || []).join(", ")}`).join("\n"),
    optionsText: config.optionsText || JSON.stringify(config.options || {}, null, 2),
  };
  return (
    <div className="membership-admin">
      <div className="membership-admin-heading"><h2>Admin: medlemskap og søknader</h2><button className="membership-secondary" type="button" onClick={logout}>Logg ut</button></div>
      <Message error={error} />
      {editableConfig && <form className="membership-form" onSubmit={saveConfig}>
        <Section title="Aktive skjemaer">
          {membershipTypes.map(([key, label]) => <label className="membership-check" key={key}><input type="checkbox" checked={editableConfig.membershipTypes?.[key] !== false} onChange={(event) => setConfig({ ...editableConfig, membershipTypes: { ...editableConfig.membershipTypes, [key]: event.target.checked } })} />{label}</label>)}
        </Section>
        <Section title="Felt i skjemaene" description="Slå felt av/på, velg om de er obligatoriske, og endre etiketten som vises. Alders- og samtykkekrav valideres også av backend.">
          {membershipTypes.map(([flow, flowLabel]) => (
            <section className="membership-field-settings membership-grid-wide" key={flow}>
              <h3>{flowLabel}</h3>
              {(configurableFields[flow] || []).map(([fieldKey, defaultLabel, defaultRequired, locked]) => {
                const setting = editableConfig.fields?.[flow]?.[fieldKey] || {};
                const isRequiredField = flow === "minor" &&
                  ["child.email", "child.phone"].includes(fieldKey);
                const update = (patch) => setConfig({
                  ...editableConfig,
                  fields: {
                    ...editableConfig.fields,
                    [flow]: {
                      ...editableConfig.fields?.[flow],
                      [fieldKey]: { ...setting, ...patch },
                    },
                  },
                });
                return (
                  <div className="membership-setting-row" key={fieldKey}>
                    <strong>{defaultLabel}</strong>
                    {locked || isRequiredField
                      ? <span className="membership-setting-locked">{typeof locked === "string" ? locked : "Påkrevd"}</span>
                      : <>
                        <label><input type="checkbox" checked={setting.visible !== false} onChange={(event) => update({ visible: event.target.checked })} /> Vis</label>
                        <label><input type="checkbox" checked={setting.required ?? defaultRequired} onChange={(event) => update({ required: event.target.checked })} /> Obligatorisk</label>
                      </>}
                    <input aria-label={`Etikett: ${defaultLabel}`} value={setting.label ?? ""} placeholder={defaultLabel} onChange={(event) => update({ label: event.target.value })} />
                  </div>
                );
              })}
            </section>
          ))}
        </Section>
        <Section title="Flere felt i standardskjemaene" description="Legg til egne felt og innholdsbokser i de eksisterende medlemskapspresetene. Slett et felt for å fjerne det fra skjemaet.">
          {membershipTypes.map(([flow, flowLabel]) => {
            const fields = editableConfig.additionalFields?.[flow] || [];
            return (
              <section className="membership-field-settings membership-grid-wide" key={flow}>
                <h3>{flowLabel}</h3>
                {fields.map((field, index) => (
                  <BuilderFieldEditor
                    key={field.id}
                    field={field}
                    allowFiles={false}
                    onChange={(updated) => updatePresetFields(flow, fields.map((item, itemIndex) => itemIndex === index ? updated : item))}
                    onRemove={() => updatePresetFields(flow, fields.filter((_, itemIndex) => itemIndex !== index))}
                  />
                ))}
                <button className="membership-secondary" type="button" onClick={() => updatePresetFields(flow, [...fields, createBuilderField()])}>
                  Legg til felt eller innholdsboks
                </button>
              </section>
            );
          })}
        </Section>
        <Section title="Innholdsbokser i standardskjemaene" description="Endre overskrifter og hjelpetekster som vises inne i standardskjemaene. Tøm hjelpeteksten for å fjerne den fra nettsiden.">
          {membershipTypes.map(([flow, flowLabel]) => (
            <section className="membership-field-settings membership-grid-wide" key={flow}>
              <h3>{flowLabel}</h3>
              {configurableSections[flow].map((title) => {
                const setting = editableConfig.sections?.[flow]?.[title] || {};
                const update = (patch) => setConfig({
                  ...editableConfig,
                  sections: {
                    ...editableConfig.sections,
                    [flow]: {
                      ...editableConfig.sections?.[flow],
                      [title]: { ...setting, ...patch },
                    },
                  },
                });
                return (
                  <div className="membership-content-setting" key={title}>
                    <strong>{title}</strong>
                    <label className="membership-field">
                      <span>Overskrift</span>
                      <input value={setting.label ?? ""} placeholder={title} maxLength={120} onChange={(event) => update({ label: event.target.value })} />
                    </label>
                    <label className="membership-field">
                      <span>Hjelpetekst</span>
                      <textarea rows="3" value={setting.description ?? ""} placeholder="Ingen tilpasset hjelpetekst" maxLength={2000} onChange={(event) => update({ description: event.target.value })} />
                    </label>
                  </div>
                );
              })}
            </section>
          ))}
        </Section>
        <Section title="Egendefinerte medlemskapsskjemaer" description="Lag et helt nytt skjema fra blankt. Innsendinger lagres som søknader for administrator og oppretter ikke medlemskonto automatisk.">
          {(editableConfig.customForms || []).map((form, formIndex) => (
            <section className="membership-custom-form-editor membership-grid-wide" key={form.id}>
              <div className="membership-grid">
                <label className="membership-field">
                  <span>Skjemanavn</span>
                  <input value={form.name} maxLength={100} onChange={(event) => {
                    const customForms = [...editableConfig.customForms];
                    customForms[formIndex] = { ...form, name: event.target.value };
                    updateCustomForms(customForms);
                  }} />
                </label>
                <label className="membership-check">
                  <input type="checkbox" checked={form.active} onChange={(event) => {
                    const customForms = [...editableConfig.customForms];
                    customForms[formIndex] = { ...form, active: event.target.checked };
                    updateCustomForms(customForms);
                  }} />
                  Aktivt på nettsiden
                </label>
                <label className="membership-field membership-grid-wide">
                  <span>Beskrivelse</span>
                  <textarea rows="3" maxLength={1000} value={form.description} onChange={(event) => {
                    const customForms = [...editableConfig.customForms];
                    customForms[formIndex] = { ...form, description: event.target.value };
                    updateCustomForms(customForms);
                  }} />
                </label>
              </div>
              <h4>Felt og innhold</h4>
              {form.fields.map((field, fieldIndex) => (
                <BuilderFieldEditor
                  key={field.id}
                  field={field}
                  onChange={(updated) => {
                    const customForms = [...editableConfig.customForms];
                    customForms[formIndex] = {
                      ...form,
                      fields: form.fields.map((item, itemIndex) => itemIndex === fieldIndex ? updated : item),
                    };
                    updateCustomForms(customForms);
                  }}
                  onRemove={() => {
                    const customForms = [...editableConfig.customForms];
                    customForms[formIndex] = {
                      ...form,
                      fields: form.fields.filter((_, itemIndex) => itemIndex !== fieldIndex),
                    };
                    updateCustomForms(customForms);
                  }}
                />
              ))}
              <div className="membership-review-actions">
                <button className="membership-secondary" type="button" onClick={() => {
                  const customForms = [...editableConfig.customForms];
                  customForms[formIndex] = { ...form, fields: [...form.fields, createBuilderField()] };
                  updateCustomForms(customForms);
                }}>Legg til felt eller innholdsboks</button>
                <button className="membership-text-button" type="button" onClick={() => updateCustomForms(editableConfig.customForms.filter((_, index) => index !== formIndex))}>
                  Slett skjema
                </button>
              </div>
            </section>
          ))}
          <button className="membership-secondary" type="button" onClick={() => {
            const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            updateCustomForms([
              ...(editableConfig.customForms || []),
              { id: `custom_${suffix}`, name: "Nytt medlemskapsskjema", description: "", active: false, fields: [] },
            ]);
          }}>Opprett blankt skjema</button>
        </Section>
        <Section title="Valg i nedtrekkslister" description="JSON med alternativ per skjema og feltnøkkel. Kjønnseksempel: { &quot;regular&quot;: { &quot;person.gender&quot;: [&quot;Mann&quot;, &quot;Kvinne&quot;, &quot;Annet&quot;] } }">
          <label className="membership-field membership-grid-wide"><span>Alternativer (JSON)</span><textarea rows="8" value={editableConfig.optionsText} onChange={(event) => setConfig({ ...editableConfig, optionsText: event.target.value })} /></label>
        </Section>
        <Section title="Regioner og lokallag" description="Én region per linje: Regionnavn: lokallag 1, lokallag 2">
          <label className="membership-field membership-grid-wide"><span>Tilgjengelige regioner og lokallag</span><textarea rows="8" value={editableConfig.regionsText} onChange={(event) => setConfig({ ...editableConfig, regionsText: event.target.value })} /></label>
        </Section>
        <Section title="Juryert opptak">
          <label className="membership-field membership-grid-wide"><span>Informasjon om innsending av produkter</span><textarea rows="4" value={editableConfig.craftShippingInstructions || ""} onChange={(event) => setConfig({ ...editableConfig, craftShippingInstructions: event.target.value })} /></label>
        </Section>
        <Message error={error} success={success} />
        <button className="membership-submit">Lagre konfigurasjon</button>
      </form>}
      <section className="membership-section">
        <h2>Mottatte søknader</h2>
        {applications.length === 0 ? <p>Ingen søknader å vise.</p> : <ul className="membership-applications">{applications.map((application) => (
          <li key={application.id}>
            <strong>{application.formName || application.type || application.kind || "Søknad"}</strong> — {application.createdAt || application.created_at || "Dato ikke oppgitt"} {application.status && <span>({application.status})</span>}
            <details>
              <summary>Vis søknadsopplysninger og vedlegg</summary>
              <pre className="membership-profile">{JSON.stringify(application.profile || {}, null, 2)}</pre>
              {application.files?.length > 0 && <ul>{application.files.map((file) => <li key={file.id}><a href={`${API}/admin/applications/${encodeURIComponent(application.id)}/files/${encodeURIComponent(file.id)}`}>{file.originalName}</a> ({Math.ceil(file.size / 1024)} KB)</li>)}</ul>}
              {["craft", "custom"].includes(application.type) && <>
                <label className="membership-field"><span>Vurderingsnotat</span><textarea rows="3" value={reviewNotes[application.id] ?? application.reviewNote ?? ""} onChange={(event) => setReviewNotes({ ...reviewNotes, [application.id]: event.target.value })} /></label>
                <div className="membership-review-actions">
                  <button className="membership-secondary" type="button" onClick={() => reviewApplication(application.id, "approved")}>Godkjenn</button>
                  <button className="membership-secondary" type="button" onClick={() => reviewApplication(application.id, "rejected")}>Avslå</button>
                  <button className="membership-secondary" type="button" onClick={() => reviewApplication(application.id, "pending_review")}>Sett til vurdering</button>
                </div>
                {activationLinks[application.id] && <p className="membership-note">
                  Del denne personlige lenken privat med søkeren. Den gir bare tilgang til å opprette passord, utløper etter 30 dager og kan brukes én gang:{" "}
                  <a href={activationLinks[application.id]}>{activationLinks[application.id]}</a>
                </p>}
              </>}
            </details>
          </li>
        ))}</ul>}
      </section>
    </div>
  );
}

export default function Membership() {
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get("type");
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [type, setType] = useState(() =>
    membershipTypes.some(([key]) => key === requestedType) || requestedType?.startsWith("custom_")
      ? requestedType
      : "regular"
  );
  const giftToken = searchParams.get("aktiver");
  const giftActivationEntry = searchParams.has("aktiver-gave") && !giftToken;
  const minorToken = searchParams.get("aktiver-mindreaarig");
  const minorActivationEntry = searchParams.has("aktiver-mindreaarig-entry") ||
    (searchParams.has("aktiver-mindreaarig") && !minorToken);
  const craftToken = searchParams.get("aktiver-haandverker");
  const craftActivationEntry = searchParams.has("aktiver-haandverker-entry") ||
    (searchParams.has("aktiver-haandverker") && !craftToken);
  const activationMode = Boolean(giftToken || giftActivationEntry || minorToken ||
    minorActivationEntry || craftToken || craftActivationEntry);

  useEffect(() => {
    request("/membership/config")
      .then(setConfig)
      .catch((error) => setLoadError(error.message));
  }, []);

  const activeOptions = [
    ...membershipTypes.filter(([key]) => config?.membershipTypes?.[key] !== false),
    ...(config?.customForms || []).filter((form) => form.active).map((form) => [form.id, form.name]),
  ];
  const selectedType = activeOptions.some(([key]) => key === type)
    ? type
    : activeOptions[0]?.[0];
  return (
    <main className="main-content membership-page">
      <p className="membership-eyebrow">Norges Husflidslag</p>
      <h1>{craftToken || craftActivationEntry
        ? "Opprett passord for husflidshåndverker"
        : minorToken || minorActivationEntry
          ? "Registrer bruker for mindreårig"
          : giftToken || giftActivationEntry
            ? "Aktiver medlemskap"
            : "Medlemskap og søknader"}</h1>
      {loadError && <Message error={loadError} />}
      <>
        {!activationMode && activeOptions.length > 0 && <nav className="membership-tabs" aria-label="Skjematype">
          {activeOptions.map(([key, label]) => <button key={key} type="button" className={selectedType === key ? "selected" : ""} onClick={() => setType(key)}>{label}</button>)}
        </nav>}
        {loadError
          ? <p>Skjemaene kunne ikke lastes. Kontroller at backend er startet.</p>
          : !config
            ? <p>Laster innstillinger …</p>
            : craftToken || craftActivationEntry
              ? <CraftAccountSetupEntry config={config} initialToken={craftToken || ""} />
              : minorToken || minorActivationEntry
                ? <MinorAccountSetupEntry config={config} initialToken={minorToken || ""} />
                : giftToken || giftActivationEntry
                  ? <GiftActivationEntry config={config} initialToken={giftToken || ""} />
                  : activeOptions.length === 0
                    ? <p>Ingen medlemskap eller skjemaer er åpne for registrering nå.</p>
                    : config.customForms?.some((form) => form.id === selectedType)
                      ? <CustomFormSubmission key={selectedType} form={config.customForms.find((form) => form.id === selectedType)} />
                      : <RegistrationForms key={selectedType} type={selectedType} config={config} />}
        <p className="membership-note">Dette er en lokal utviklingsversjon. Ikke bruk ekte personopplysninger. Betaling og e-postutsending er ikke koblet til.</p>
      </>
    </main>
  );
}
