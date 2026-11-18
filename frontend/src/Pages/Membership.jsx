// Håndterer medlemsregistrering, aktivering og tilpassede skjemaer
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { request, useAdminSession } from "./MembershipApi.js";
import { configurableFields, defaultCraftTypes, emptyAddress, membershipTypes } from "./MembershipConfig.js";
import {
  AddressFields,
  CheckField,
  DynamicFormFields,
  Field,
  LocalGroupFields,
  Message,
  PasswordFields,
  PersonFields,
  Section,
  SelectField,
  TextAreaField,
} from "./MembershipFormFields.jsx";
import { FormConfigContext } from "./MembershipFormContext.js";
import "./Membership.css";

export { MembershipAdminPage } from "./MembershipAdmin.jsx";

const emptyPerson = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  email: "",
  phone: "",
};

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

const agreementDefaults = { termsAccepted: false, emailOffers: false, smsOffers: false };

function AgreementFields({ form, onChange }) {
  const checkbox = (fieldKey, label, extraProps = {}) => (
    <CheckField fieldKey={fieldKey} label={label} checked={form[fieldKey]} onChange={(event) => onChange({ [fieldKey]: event.target.checked })} forceVisible {...extraProps} />
  );
  return (
    <section className="membership-section">
      {checkbox("termsAccepted", "Jeg aksepterer Norges Husflidslags vilkår og betingelser til bruk", { required: true, forceRequired: true })}
      {checkbox("emailOffers", "Jeg ønsker å få tilsendt e-post om tilbud og kampanjer hos Norges Husflidslag")}
      {checkbox("smsOffers", "Jeg ønsker å få tilsendt SMS om tilbud og kampanjer hos Norges Husflidslag")}
    </section>
  );
}

function validateAgreements(form) {
  return form.termsAccepted
    ? []
    : [{ key: "termsAccepted", label: "Vilkår og betingelser", message: "må aksepteres" }];
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

  issues.push(...validateAgreements(form));

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

function CustomFormSubmission({ form }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const includeAgreements = form.includeAgreements !== false;
  const formValues = { ...agreementDefaults, ...values };
  const findIssues = () => [
    ...validateCustomForm(form.fields, values),
    ...(includeAgreements ? validateAgreements(formValues) : []),
  ];
  const validationIssues = validationAttempted ? findIssues() : [];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult("");
    setValidationAttempted(true);
    if (findIssues().length > 0) return;
    setBusy(true);
    try {
      const fileFields = form.fields.filter((field) => field.type === "file");
      const payload = Object.fromEntries(
        Object.entries(includeAgreements ? formValues : values).filter(([id]) => !fileFields.some((field) => field.id === id))
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
      {includeAgreements && (
        <FormConfigContext.Provider value={{ validationErrors }}>
          <AgreementFields form={formValues} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} />
        </FormConfigContext.Provider>
      )}
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
  const form = { ...agreementDefaults, ...defaults[type], ...values };
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
            <PersonFields title="Forelders informasjon" number={index + 1} fieldPrefix="parent" validationPrefix={`parents.${index}`} value={parent} onChange={(updated) => setForm({ parents: form.parents.map((item, i) => i === index ? updated : item) })} lockedFields={["firstName", "lastName", "gender", "email", "phone"]} />
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
        <Section title="Søkerens fødselsdato">
          <Field label="Fødselsdato" fieldKey="applicant.birthDate" type="date" value={form.applicant.birthDate} onChange={(event) => setNested("applicant", { birthDate: event.target.value })} required forceRequired forceVisible />
          <p className="membership-note">Søkeren må være 18 år eller eldre.</p>
        </Section>
        {address("applicant.address", "Søkerens adresse", "applicant.address")}
        <Section title="Håndverkstype">
          <SelectField label="Velg håndverkstype" fieldKey="craftType" value={form.craftType} onChange={(event) => setForm({ craftType: event.target.value })} required options={defaultCraftTypes} />
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
          <p className="membership-note">{config?.craftShippingInstructions || "Informasjon om hvor produktene skal sendes er ikke satt ennå."}</p>
        </>}
        <LocalGroupFields config={config} fieldPrefix="localGroup" region={form.region} chapter={form.chapter} onChange={changeGroup} optional />
        <CheckField fieldKey="criteriaAccepted" label="Jeg har forstått medlemskriteriene for Norske Husflidshåndverkere i Norges Husflidslag." checked={form.criteriaAccepted} onChange={(event) => setForm({ criteriaAccepted: event.target.checked })} required forceRequired forceVisible />
      </>}

      <DynamicFormFields
        fields={config?.additionalFields?.[type] || []}
        values={form}
        onChange={(id, value) => setForm({ [id]: value })}
      />

      <AgreementFields form={form} onChange={setForm} />

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

function ActivationCodeEntry({ onSubmit, code, setCode, error, busy, validationErrors = {}, validationIssues = [] }) {
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

function AccountPasswordSetup({ type, token, identifier }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const validationIssues = validationAttempted ? validatePasswordSetup(password, confirmPassword) : [];
  const validationErrors = Object.fromEntries(validationIssues.map((issue) => [issue.key, issue.message]));
  const isMinor = type === "minor";

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setValidationAttempted(true);
    if (validatePasswordSetup(password, confirmPassword).length > 0) return;
    setBusy(true);
    try {
      const result = await request(`/membership/${type}/activate/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      const successMessage = result.message || (isMinor
        ? "Innloggingen for barnet er registrert."
        : "Husflidshåndverker-medlemskapet er aktivert.");
      setSuccess(isMinor
        ? successMessage
        : `${successMessage} Du kan nå logge inn med e-postadressen fra søknaden.`);
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
      <h2>{isMinor ? "Registrer bruker for mindreårig" : "Opprett passord for husflidshåndverker"}</h2>
      <p>{isMinor
        ? "Velg passordet barnet skal bruke sammen med den registrerte e-postadressen."
        : "Velg passordet du vil bruke når du logger inn med e-postadressen fra søknaden."}</p>
      <PasswordFields
        password={password}
        confirmPassword={confirmPassword}
        onChange={(key, value) => key === "password" ? setPassword(value) : setConfirmPassword(value)}
        validationErrors={validationErrors}
      />
      <Message error={error} success={success} />
      <ValidationSummary issues={validationIssues} />
      <button className="membership-submit" disabled={busy}>
        {busy ? "Lagrer …" : isMinor ? "Lagre innlogging" : "Lagre passord"}
      </button>
    </form>
  );
}

const activationTypes = {
  gift: {
    query: "aktiver",
    title: "Aktiver mottatt medlemskap",
  },
  minor: {
    query: "aktiver-mindreaarig",
    title: "Registrer bruker for mindreårig",
  },
  craft: {
    query: "aktiver-haandverker",
    title: "Opprett passord for husflidshåndverker",
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
    return trimmed;
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
    <ActivationCodeEntry
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
  if (type === "minor") return <AccountPasswordSetup type="minor" token={token} identifier={identifier} />;
  return <AccountPasswordSetup type="craft" token={token} identifier={identifier} />;
}

export default function Membership() {
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get("type");
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState("");
  const { authenticated: isAdmin, error: adminStatusError } = useAdminSession();
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
      {isAdmin && <section className="membership-admin-card">
        <div>
          <h2>Rediger medlemskap</h2>
          <p>Administrer medlemskapsskjemaer og innsendte søknader.</p>
        </div>
        <Link className="membership-submit" to="/medlemskap/rediger">Åpne administrasjon</Link>
      </section>}
      {adminStatusError && <Message error={adminStatusError} />}
      <>
        {!activationMode && activeOptions.length > 0 && <nav className="membership-tabs" aria-label="Skjematype">
          {activeOptions.map(([key, label]) => <button key={key} type="button" className={selectedType === key ? "selected" : ""} onClick={() => setType(key)}>{label}</button>)}
        </nav>}
        {loadError
          ? <p>Skjemaene kunne ikke lastes. Kontroller at backend er startet.</p>
          : !config
            ? <p>Laster innstillinger …</p>
            : craftToken || craftActivationEntry
              ? <ActivationFlow type="craft" config={config} initialToken={craftToken || ""} />
              : minorToken || minorActivationEntry
                ? <ActivationFlow type="minor" config={config} initialToken={minorToken || ""} />
                : giftToken || giftActivationEntry
                  ? <ActivationFlow type="gift" config={config} initialToken={giftToken || ""} />
                  : activeOptions.length === 0
                    ? <p>Ingen medlemskap eller skjemaer er åpne for registrering nå.</p>
                    : config.customForms?.some((form) => form.id === selectedType)
                      ? <CustomFormSubmission key={selectedType} form={config.customForms.find((form) => form.id === selectedType)} />
                      : <RegistrationForms key={selectedType} type={selectedType} config={config} />}
        <p className="membership-note">* Obligatoriske felt: Må fylles ut</p>
        <p className="membership-note">Dette er en lokal utviklingsversjon. Ikke bruk ekte personopplysninger. Betaling og e-postutsending er ikke koblet til.</p>
      </>
    </main>
  );
}
