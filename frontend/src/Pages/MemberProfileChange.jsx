import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "./api.js";
import "./Membership.css";

const fieldLabels = {
  firstName: "Fornavn",
  middleName: "Mellomnavn",
  lastName: "Etternavn",
  gender: "Kjønn",
  email: "E-post",
  phone: "Telefonnummer",
  birthDate: "Fødselsdato",
  street: "Gateadresse",
  postalCode: "Postnummer",
  city: "Poststed",
  name: "Navn",
  organizationNumber: "Organisasjonsnummer",
  website: "Nettside",
  qualificationConfirmed: "Kvalifikasjonsbekreftelse",
  consent: "Samtykke fra foresatt",
  parents: "Foresatte",
  person: "Personlig informasjon",
  child: "Barnets informasjon",
  recipient: "Mottakerens informasjon",
  applicant: "Søkerens informasjon",
  business: "Bedriftsinformasjon",
  address: "Adresse",
};

function getProfileFields(profile) {
  const fields = [];
  function visit(value, path = []) {
    if (path[0] === "localGroup") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => visit(item, [...path, key]));
      return;
    }
    if (path.length) fields.push({ path, value });
  }
  visit(profile);
  return fields;
}

function getFieldLabel(field) {
  const parts = field.path.map((part) => {
    if (/^\d+$/.test(part)) return `Foresatt ${Number(part) + 1}`;
    return fieldLabels[part] || part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
  });
  return parts.join(" · ");
}

function updateProfileValue(profile, path, value) {
  const [key, ...remainingPath] = path;
  const updatedProfile = Array.isArray(profile) ? [...profile] : { ...profile };
  updatedProfile[key] = remainingPath.length
    ? updateProfileValue(profile?.[key], remainingPath, value)
    : value;
  return updatedProfile;
}

function inputType(path) {
  const fieldName = path.at(-1).toLowerCase();
  if (fieldName === "email") return "email";
  if (fieldName === "phone") return "tel";
  if (fieldName === "birthdate") return "date";
  return "text";
}

function isOptional(path) {
  const fieldName = path.at(-1);
  return fieldName === "middleName" || fieldName === "website";
}

function ProfileField({ field, onChange }) {
  const label = getFieldLabel(field);
  const isCheckbox = typeof field.value === "boolean";
  const inputValue = isCheckbox ? undefined : field.value ?? "";

  return (
    <label className={isCheckbox ? "membership-check" : "membership-field"}>
      {isCheckbox ? null : <span>{label}</span>}
      <input
        type={isCheckbox ? "checkbox" : inputType(field.path)}
        checked={isCheckbox ? field.value : undefined}
        value={inputValue}
        required={!isCheckbox && !isOptional(field.path)}
        onChange={(event) => onChange(isCheckbox ? event.target.checked : event.target.value)}
      />
      {isCheckbox && label}
    </label>
  );
}

function ProfileSection({ name, fields, onFieldChange }) {
  const sectionLabel = fieldLabels[name] || name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());

  return (
    <section className="membership-section">
      <h2>{sectionLabel}</h2>
      <div className="membership-grid">
        {fields.map((field) => (
          <ProfileField
            field={field}
            key={field.path.join(".")}
            onChange={(value) => onFieldChange(field.path, value)}
          />
        ))}
      </div>
    </section>
  );
}

export default function MemberProfileChange() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiRequest(`/membership/profile/change/${encodeURIComponent(token)}`, { credentials: "same-origin", headers: { "Content-Type": "application/json" } })
      .then((data) => setProfile(data.profile))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const editableProfile = Object.fromEntries(
        Object.entries(profile).filter(([field]) => field !== "localGroup")
      );
      await apiRequest(`/membership/profile/change/${encodeURIComponent(token)}`, {
        credentials: "same-origin",
        method: "PUT",
        body: JSON.stringify({ profile: editableProfile }),
      });
      window.location.assign("/min-side");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  const fields = profile ? getProfileFields(profile) : [];
  const visibleError = token ? error : "Lenken mangler eller er ugyldig.";
  const sections = fields.reduce((groups, field) => {
    const section = field.path.length > 1 ? field.path[0] : "Personopplysninger";
    (groups[section] ||= []).push(field);
    return groups;
  }, {});

  return (
    <main className="main-content membership-page">
      <p className="membership-eyebrow">Medlemsområde</p>
      <h1>Endre personopplysninger</h1>
      <p>Lokallag kan endres separat fra Min side.</p>
      {loading ? <p>Kontrollerer lenken …</p> : visibleError && !profile ? (
        <p className="membership-alert membership-error" role="alert">{visibleError}</p>
      ) : profile && (
        <form className="membership-form" onSubmit={saveProfile}>
          {Object.entries(sections).map(([section, sectionFields]) => (
            <ProfileSection
              key={section}
              name={section}
              fields={sectionFields}
              onFieldChange={(path, value) => setProfile((current) =>
                updateProfileValue(current, path, value)
              )}
            />
          ))}
          {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
          <button className="membership-submit" disabled={busy}>
            {busy ? "Lagrer …" : "Lagre personopplysninger"}
          </button>
        </form>
      )}
      {!loading && !profile && <Link className="membership-secondary" to="/min-side">Til Min side</Link>}
    </main>
  );
}
