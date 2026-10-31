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
    ["child.email", "Barnets e-post", true, "Påkrevd for medlemskonto"],
    ["child.phone", "Barnets telefonnummer", true, "Påkrevd for medlemskonto"],
    ["child.birthDate", "Barnets fødselsdato", true, "Påkrevd for alderskontroll"],
    ["parent.firstName", "Forelders fornavn", true, "Påkrevd for foresatt"],
    ["parent.middleName", "Forelders mellomnavn", false],
    ["parent.lastName", "Forelders etternavn", true, "Påkrevd for foresatt"],
    ["parent.gender", "Forelders kjønn", true, "Påkrevd for foresatt"],
    ["parent.email", "Forelders e-post", true, "Påkrevd for foresatt"],
    ["parent.phone", "Forelders telefonnummer", true, "Påkrevd for foresatt"],
    ["password", "Passord", true, "Påkrevd for medlemskonto"],
    ["confirmPassword", "Bekreft passord", true],
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

function membershipActivationPath(value) {
  const activationUrl = new URL(value, window.location.origin);
  const tokenFromQuery = activationUrl.searchParams.get("aktiver");
  const tokenFromPath = activationUrl.pathname.match(/\/gift\/activate\/([^/]+)$/)?.[1];
  const token = tokenFromQuery || tokenFromPath;
  if (!token || !/^[A-Za-z0-9_-]{30,60}$/.test(token)) {
    throw new Error("Backend returnerte en ugyldig aktiveringslenke.");
  }
  return `/medlemskap?aktiver=${encodeURIComponent(token)}`;
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
  fieldKey,
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
  return (
    <label className="membership-field">
      <span>{fieldLabel}{fieldRequired && <span aria-hidden="true"> *</span>}</span>
      <input
        name={name || fieldKey || label}
        type={type}
        {...(type === "file" ? {} : { value: value ?? "" })}
        onChange={onChange}
        required={fieldRequired}
        placeholder={fieldPlaceholder}
        autoComplete={autoComplete}
        {...props}
      />
    </label>
  );
}

function TextAreaField({ label, fieldKey, value, onChange, rows = 4 }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey] || {};
  if (setting.visible === false) return null;
  const required = setting.required ?? false;
  return (
    <label className="membership-field membership-grid-wide">
      <span>{setting.label || label}{required && <span aria-hidden="true"> *</span>}</span>
      <textarea rows={rows} value={value ?? ""} onChange={onChange} required={required} placeholder={setting.placeholder ?? label} />
    </label>
  );
}

function CheckField({ label, fieldKey, checked, onChange, required = false, forceRequired = false, forceVisible = false }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey] || {};
  if (setting.visible === false && !forceVisible) return null;
  const fieldRequired = forceRequired || (setting.required ?? required);
  return (
    <label className="membership-check">
      <input type="checkbox" checked={Boolean(checked)} onChange={onChange} required={fieldRequired} />
      {setting.label || label}
      {fieldRequired && <span aria-hidden="true"> *</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options, required = false, fieldKey, forceRequired = false, forceVisible = false }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.fields?.[formConfig.flow]?.[fieldKey || label] || {};
  if (setting.visible === false && !forceVisible) return null;
  const isLocalGroupField = fieldKey?.endsWith(".region") || fieldKey?.endsWith(".chapter");
  const fieldOptions = isLocalGroupField ? options : formConfig?.options?.[formConfig.flow]?.[fieldKey || label] || options;
  const fieldRequired = forceRequired || (setting.required ?? required);
  return (
    <label className="membership-field">
      <span>{setting.label || label}{fieldRequired && <span aria-hidden="true"> *</span>}</span>
      <select value={value ?? ""} onChange={onChange} required={fieldRequired}>
        <option value="">Velg …</option>
        {fieldOptions.map((option) => (
          <option value={option} key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children, description }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.sections?.[formConfig.flow]?.[title] || {};
  if (setting.visible === false) return null;
  return (
    <section className="membership-section">
      <h2>{setting.label || title}</h2>
      {description && <p className="membership-muted">{description}</p>}
      <div className="membership-grid">{children}</div>
    </section>
  );
}

function AddressFields({ value = emptyAddress, onChange, fieldPrefix }) {
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
      />
      <Field
        label="Postnummer"
        fieldKey={`${fieldPrefix}.postalCode`}
        value={value.postalCode}
        onChange={(event) => onChange({ ...value, postalCode: event.target.value })}
        required
        inputMode="numeric"
        autoComplete={`${autocompleteSection} postal-code`}
      />
      <Field
        label="Poststed"
        fieldKey={`${fieldPrefix}.city`}
        value={value.city}
        onChange={(event) => onChange({ ...value, city: event.target.value })}
        required
        autoComplete={`${autocompleteSection} address-level2`}
      />
    </>
  );
}

function PersonFields({ title, value, onChange, includeEmail = true, includePhone = true, fieldPrefix, forceRequired = false, forceVisible = false, lockedFields = [] }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const isLocked = (key) => forceRequired || forceVisible || lockedFields.includes(key);
  return (
    <Section title={title}>
      <Field label="Fornavn" fieldKey={`${fieldPrefix}.firstName`} value={value.firstName} onChange={set("firstName")} required forceRequired={forceRequired || lockedFields.includes("firstName")} forceVisible={isLocked("firstName")} autoComplete="given-name" />
      <Field label="Mellomnavn (valgfritt)" fieldKey={`${fieldPrefix}.middleName`} value={value.middleName} onChange={set("middleName")} forceVisible={forceVisible} autoComplete="additional-name" />
      <Field label="Etternavn" fieldKey={`${fieldPrefix}.lastName`} value={value.lastName} onChange={set("lastName")} required forceRequired={forceRequired || lockedFields.includes("lastName")} forceVisible={isLocked("lastName")} autoComplete="family-name" />
      <SelectField label="Kjønn" fieldKey={`${fieldPrefix}.gender`} value={value.gender} onChange={set("gender")} options={["Mann", "Kvinne", "Annet"]} required forceRequired={forceRequired || lockedFields.includes("gender")} forceVisible={isLocked("gender")} />
      {includeEmail && <Field label="E-post" fieldKey={`${fieldPrefix}.email`} type="email" value={value.email} onChange={set("email")} required forceRequired={forceRequired || lockedFields.includes("email")} forceVisible={isLocked("email")} autoComplete="email" />}
      {includePhone && <Field label="Telefonnummer" fieldKey={`${fieldPrefix}.phone`} type="tel" value={value.phone} onChange={set("phone")} required forceRequired={forceRequired || lockedFields.includes("phone")} forceVisible={isLocked("phone")} autoComplete="tel" />}
    </Section>
  );
}

function LocalGroupFields({ config, region, chapter, onChange, optional = false, fieldPrefix }) {
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
      />
      <SelectField
        label="Lokallag"
        fieldKey={`${fieldPrefix}.chapter`}
        value={chapter}
        onChange={(event) => onChange(region, event.target.value)}
        options={chapters}
        required={Boolean(region)}
        forceRequired={Boolean(region)}
      />
    </Section>
  );
}

function PasswordFields({ password, confirmPassword, onChange, fieldPrefix }) {
  const passwordKey = fieldPrefix ? `${fieldPrefix}.password` : "password";
  const confirmationKey = fieldPrefix ? `${fieldPrefix}.confirmPassword` : "confirmPassword";
  return (
    <Section title="Passord">
      <Field label="Passord" fieldKey={passwordKey} type="password" value={password} onChange={(event) => onChange("password", event.target.value)} required forceRequired forceVisible minLength={12} autoComplete="new-password" />
      <Field label="Bekreft passord" fieldKey={confirmationKey} type="password" value={confirmPassword} onChange={(event) => onChange("confirmPassword", event.target.value)} required forceRequired forceVisible minLength={12} autoComplete="new-password" />
      <p className="membership-note membership-grid-wide">Passordet må være minst 12 tegn. Bekreftelsen må være identisk.</p>
    </Section>
  );
}

function Message({ error, success }) {
  if (error) return <p className="membership-alert membership-error" role="alert">{error}</p>;
  if (success) return <p className="membership-alert membership-success" role="status">{success}</p>;
  return null;
}

function RegistrationForms({ type, config }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const defaults = useMemo(() => ({
    regular: { ...emptyPerson, birthDate: "", password: "", confirmPassword: "", address: { ...emptyAddress }, region: "", chapter: "" },
    minor: { child: { ...emptyPerson, birthDate: "" }, parents: [{ ...emptyPerson }], password: "", confirmPassword: "", address: { ...emptyAddress }, region: "", chapter: "", consent: false },
    gift: { purchaser: { ...emptyPerson, birthDate: "", address: { ...emptyAddress } }, recipient: { ...emptyPerson, birthDate: "", address: { ...emptyAddress } }, guardian: { ...emptyPerson }, consent: false, region: "", chapter: "" },
    craft: { business: { name: "", organizationNumber: "", address: { ...emptyAddress }, phone: "", email: "", website: "" }, applicant: { ...emptyPerson, birthDate: "", address: { ...emptyAddress } }, craftType: "", admissionMethod: "", jury: {}, region: "", chapter: "", criteriaAccepted: false },
  }), []);
  const form = { ...defaults[type], ...values };
  const giftRecipientAge = type === "gift" ? getAge(form.recipient.birthDate) : null;
  const [result, setResult] = useState("");
  const [activationUrl, setActivationUrl] = useState("");

  const setForm = (patch) => setValues((current) => ({ ...current, ...patch }));
  const setNested = (key, patch) => setForm({ [key]: { ...form[key], ...patch } });
  const changeGroup = (region, chapter) => setForm({ region, chapter });

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult("");
    if (form.password && form.password !== form.confirmPassword) {
      setError("Passordene er ikke like.");
      return;
    }
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
    <FormConfigContext.Provider value={{ ...config, flow: type }}>
    <form className="membership-form" onSubmit={submit}>
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
        <PersonFields title="Barnets informasjon" fieldPrefix="child" value={form.child} onChange={(child) => setForm({ child })} lockedFields={["email", "phone"]} />
        <Section title="Barnets alder">
          <Field label="Barnets fødselsdato" fieldKey="child.birthDate" type="date" value={form.child.birthDate} onChange={(event) => setNested("child", { birthDate: event.target.value })} required forceRequired forceVisible />
          <p className="membership-note">Barnet må være under 18 år.</p>
        </Section>
        {form.parents.map((parent, index) => (
          <div className="membership-parent" key={index}>
            <PersonFields title={index === 0 ? "Forelders informasjon" : `Forelder ${index + 1}`} fieldPrefix="parent" value={parent} onChange={(updated) => setForm({ parents: form.parents.map((item, i) => i === index ? updated : item) })} lockedFields={["firstName", "lastName", "gender", "email", "phone"]} />
            {index > 0 && <button className="membership-text-button" type="button" onClick={() => setForm({ parents: form.parents.filter((_, i) => i !== index) })}>Fjern denne forelderen</button>}
          </div>
        ))}
        <button className="membership-secondary" type="button" onClick={() => setForm({ parents: [...form.parents, { ...emptyPerson }] })}>Legg til en forelder</button>
        {password}
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
            {admissionChoices.includes("certificate") && <label className="membership-check"><input type="radio" name="admissionMethod" value="certificate" required checked={form.admissionMethod === "certificate"} onChange={() => setForm({ admissionMethod: "certificate" })} /> Automatisk opptak med svennebrev/fagbrev</label>}
            {admissionChoices.includes("jury") && <label className="membership-check"><input type="radio" name="admissionMethod" value="jury" required checked={form.admissionMethod === "jury"} onChange={() => setForm({ admissionMethod: "jury" })} /> Juryert opptak: egenportefølje</label>}
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

      <Message error={error} success={result} />
      {activationUrl && <p className="membership-alert membership-success">Del denne lenken privat med mottakeren: <a href={activationUrl}>Mottatt medlemskap? Trykk her</a></p>}
      <button className="membership-submit" type="submit" disabled={busy}>
        {busy ? "Sender …" : type === "gift" ? "Send inn gavekjøp" : type === "craft" ? "Send søknad" : "Registrer medlemskap"}
      </button>
    </form>
    </FormConfigContext.Provider>
  );
}

function GiftActivation({ config, token }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [region, setRegion] = useState("");
  const [chapter, setChapter] = useState("");
  const [activationInfo, setActivationInfo] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    request(`/membership/gift/activate/${encodeURIComponent(token)}`)
      .then((info) => {
        if (!active) return;
        setActivationInfo(info);
        setRegion(info.localGroup?.region || "");
        setChapter(info.localGroup?.chapter || "");
      })
      .catch((activationError) => {
        if (active) setError(activationError.message);
      });
    return () => { active = false; };
  }, [token]);

  async function activate(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passordene er ikke like.");
      return;
    }
    setBusy(true);
    try {
      const data = await request(`/membership/gift/activate/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({
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
    <form className="membership-form" onSubmit={activate}>
      <h2>Aktiver mottatt medlemskap</h2>
      <p>Opprett et passord for medlemskontoen.</p>
      <PasswordFields password={password} confirmPassword={confirmPassword} onChange={(key, value) => key === "password" ? setPassword(value) : setConfirmPassword(value)} />
      {activationInfo?.groupSelected
        ? <p className="membership-note">Lokallag valgt ved kjøpet: {region} — {chapter}</p>
        : config.regions?.length > 0 && <LocalGroupFields config={config} fieldPrefix="localGroup" region={region} chapter={chapter} onChange={(r, c) => { setRegion(r); setChapter(c); }} />}
      <Message error={error} success={success} />
      <button className="membership-submit" disabled={busy || !activationInfo}>{busy ? "Aktiverer …" : "Aktiver medlemskap"}</button>
    </form>
  );
}

function GiftActivationEntry() {
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

export function AdminPanel() {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [authenticated, setAuthenticated] = useState(false);
  const [config, setConfig] = useState(null);
  const [applications, setApplications] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
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
        Object.entries(fields[flow] || {}).filter(([, setting]) => setting.required).map(([field]) => field),
      ]));
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
      setSuccess(result.message || "Søknaden er oppdatert.");
      const records = await request("/admin/applications");
      setApplications(records.applications || []);
    } catch (reviewError) {
      setError(reviewError.message);
    }
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
                    {locked
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
            <strong>{application.type || application.kind || "Søknad"}</strong> — {application.createdAt || application.created_at || "Dato ikke oppgitt"} {application.status && <span>({application.status})</span>}
            <details>
              <summary>Vis søknadsopplysninger og vedlegg</summary>
              <pre className="membership-profile">{JSON.stringify(application.profile || {}, null, 2)}</pre>
              {application.files?.length > 0 && <ul>{application.files.map((file) => <li key={file.id}><a href={`${API}/admin/applications/${encodeURIComponent(application.id)}/files/${encodeURIComponent(file.id)}`}>{file.originalName}</a> ({Math.ceil(file.size / 1024)} KB)</li>)}</ul>}
              {application.type === "craft" && <>
                <label className="membership-field"><span>Vurderingsnotat</span><textarea rows="3" value={reviewNotes[application.id] ?? application.reviewNote ?? ""} onChange={(event) => setReviewNotes({ ...reviewNotes, [application.id]: event.target.value })} /></label>
                <div className="membership-review-actions">
                  <button className="membership-secondary" type="button" onClick={() => reviewApplication(application.id, "approved")}>Godkjenn</button>
                  <button className="membership-secondary" type="button" onClick={() => reviewApplication(application.id, "rejected")}>Avslå</button>
                  <button className="membership-secondary" type="button" onClick={() => reviewApplication(application.id, "pending_review")}>Sett til vurdering</button>
                </div>
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
    membershipTypes.some(([key]) => key === requestedType) ? requestedType : "regular"
  );
  const giftToken = searchParams.get("aktiver");
  const giftActivationEntry = searchParams.has("aktiver-gave") && !giftToken;

  useEffect(() => {
    request("/membership/config")
      .then(setConfig)
      .catch((error) => setLoadError(error.message));
  }, []);

  const activeOptions = membershipTypes.filter(([key]) => config?.membershipTypes?.[key] !== false);
  const selectedType = activeOptions.some(([key]) => key === type)
    ? type
    : activeOptions[0]?.[0];
  return (
    <main className="main-content membership-page">
      <p className="membership-eyebrow">Norges Husflidslag</p>
      <h1>{giftToken || giftActivationEntry ? "Aktiver medlemskap" : "Medlemskap og søknader"}</h1>
      {loadError && <Message error={loadError} />}
      <>
        {!giftToken && !giftActivationEntry && activeOptions.length > 0 && <nav className="membership-tabs" aria-label="Skjematype">
          {activeOptions.map(([key, label]) => <button key={key} type="button" className={selectedType === key ? "selected" : ""} onClick={() => setType(key)}>{label}</button>)}
        </nav>}
        {giftActivationEntry
          ? <GiftActivationEntry />
          : loadError ? <p>Skjemaene kunne ikke lastes. Kontroller at backend er startet.</p> : !config ? <p>Laster innstillinger …</p> : giftToken
          ? <GiftActivation config={config} token={giftToken} />
          : activeOptions.length === 0
            ? <p>Ingen medlemskap eller skjemaer er åpne for registrering nå.</p>
            : <RegistrationForms key={selectedType} type={selectedType} config={config} />}
        <p className="membership-note">Dette er en lokal utviklingsversjon. Ikke bruk ekte personopplysninger. Betaling og e-postutsending er ikke koblet til.</p>
      </>
    </main>
  );
}
