// Inneholder skjemafelt for medlemsregistrering og konfigurerte skjemaer
import { useContext } from "react";
import { defaultGenderOptions, emptyAddress } from "./MembershipConfig.js";
import { FormConfigContext } from "./MembershipFormContext.js";

export function Field({
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

export function TextAreaField({ label, fieldKey, value, onChange, rows = 4, required = false, validationErrors, validationKey = fieldKey }) {
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

export function CheckField({ label, fieldKey, checked, onChange, required = false, forceRequired = false, forceVisible = false, validationErrors, validationKey = fieldKey }) {
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

export function SelectField({ label, value, onChange, options, required = false, fieldKey, forceRequired = false, forceVisible = false, validationErrors, validationKey = fieldKey }) {
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

export function Section({ title, children, description, number }) {
  const formConfig = useContext(FormConfigContext);
  const setting = formConfig?.sections?.[formConfig.flow]?.[title] || {};
  if (setting.visible === false) return null;
  const sectionDescription = Object.hasOwn(setting, "description") ? setting.description : description;
  return (
    <section className="membership-section">
      <h2>{setting.label || title}{number != null && ` ${number}`}</h2>
      {sectionDescription && <p className="membership-muted">{sectionDescription}</p>}
      <div className="membership-grid">{children}</div>
    </section>
  );
}

export function AddressFields({ value = emptyAddress, onChange, fieldPrefix, validationErrors = {} }) {
  const autocompleteSection = `section-${fieldPrefix.replaceAll(".", "-")}`;
  const fields = [
    ["street", "Gateadresse", "address-line1"],
    ["postalCode", "Postnummer", "postal-code"],
    ["city", "Poststed", "address-level2"],
  ];
  return fields.map(([key, label, autocomplete]) => (
    <Field
      key={key}
      label={label}
      fieldKey={`${fieldPrefix}.${key}`}
      value={value[key]}
      onChange={(event) => onChange({
        ...value,
        [key]: event.target.value,
        ...(key === "street" ? { postalCode: "", city: "" } : {}),
      })}
      required
      inputMode={key === "postalCode" ? "numeric" : undefined}
      autoComplete={`${autocompleteSection} ${autocomplete}`}
      validationErrors={validationErrors}
    />
  ));
}

export function PersonFields({ title, number, value, onChange, includeEmail = true, includePhone = true, fieldPrefix, validationPrefix = fieldPrefix, validationErrors, forceRequired = false, forceVisible = false, forceVisibleFields = [], optionalFields = [], loginContactNotes = false, lockedFields = [] }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const isForcedVisible = (key) => forceRequired || forceVisible || lockedFields.includes(key) || forceVisibleFields.includes(key);
  return (
    <Section title={title} number={number}>
      <Field label="Fornavn" fieldKey={`${fieldPrefix}.firstName`} validationKey={`${validationPrefix}.firstName`} validationErrors={validationErrors} value={value.firstName} onChange={set("firstName")} required forceRequired={forceRequired || lockedFields.includes("firstName")} forceVisible={isForcedVisible("firstName")} autoComplete="given-name" />
      <Field label="Mellomnavn (valgfritt)" fieldKey={`${fieldPrefix}.middleName`} validationKey={`${validationPrefix}.middleName`} validationErrors={validationErrors} value={value.middleName} onChange={set("middleName")} forceVisible={isForcedVisible("middleName")} autoComplete="additional-name" />
      <Field label="Etternavn" fieldKey={`${fieldPrefix}.lastName`} validationKey={`${validationPrefix}.lastName`} validationErrors={validationErrors} value={value.lastName} onChange={set("lastName")} required forceRequired={forceRequired || lockedFields.includes("lastName")} forceVisible={isForcedVisible("lastName")} autoComplete="family-name" />
      <SelectField label="Kjønn" fieldKey={`${fieldPrefix}.gender`} validationKey={`${validationPrefix}.gender`} validationErrors={validationErrors} value={value.gender} onChange={set("gender")} options={defaultGenderOptions} required forceRequired={forceRequired || lockedFields.includes("gender")} forceVisible={isForcedVisible("gender")} />
      {includeEmail && <Field label="E-post" fieldKey={`${fieldPrefix}.email`} validationKey={`${validationPrefix}.email`} validationErrors={validationErrors} type="email" value={value.email} onChange={set("email")} required optional={optionalFields.includes("email")} forceRequired={forceRequired || lockedFields.includes("email")} forceVisible={isForcedVisible("email")} hint={loginContactNotes ? "NB: Denne e-posten vil brukes til innlogging" : undefined} autoComplete="email" />}
      {includePhone && <Field label="Telefonnummer" fieldKey={`${fieldPrefix}.phone`} validationKey={`${validationPrefix}.phone`} validationErrors={validationErrors} type="tel" value={value.phone} onChange={set("phone")} required optional={optionalFields.includes("phone")} forceRequired={forceRequired || lockedFields.includes("phone")} forceVisible={isForcedVisible("phone")} hint={loginContactNotes ? "NB: Dette telefonnummeret vil brukes til innlogging" : undefined} autoComplete="tel" />}
    </Section>
  );
}

export function LocalGroupFields({ config, region, chapter, onChange, optional = false, fieldPrefix, validationErrors }) {
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

export function PasswordFields({ password, confirmPassword, onChange, fieldPrefix, validationErrors }) {
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

export function Message({ error, success }) {
  if (error) return <p className="membership-alert membership-error" role="alert">{error}</p>;
  if (success) return <p className="membership-alert membership-success" role="status">{success}</p>;
  return null;
}

export function DynamicFormFields({ fields, values, onChange, validationErrors }) {
  const formConfig = useContext(FormConfigContext);
  const errors = validationErrors || formConfig?.validationErrors || {};
  return fields.map((field) => {
    // Feltkomponenten velges fra serverkonfigurasjonen, så administratoropprettede skjemaer kan gjenbrukes
    if (field.type === "section") return (
      <section className="membership-section" key={field.id}>
        <h2>{field.label}</h2>
        {field.content && <p className="membership-muted">{field.content}</p>}
      </section>
    );
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

    const inputType = { email: "email", phone: "tel", date: "date" }[field.type] || field.type;
    const updateValue = (event) => onChange(
      field.id,
      field.type === "file" ? Array.from(event.target.files || []) : event.target.value,
    );
    const commonProps = {
      key: field.id,
      fieldKey: field.id,
      label: field.label,
      required: field.required,
      validationErrors: errors,
      onChange: updateValue,
    };
    if (field.type === "select") return (
      <SelectField {...commonProps} value={values[field.id]} options={field.options || []} />
    );
    if (field.type === "textarea") return (
      <TextAreaField {...commonProps} value={values[field.id]} rows={4} />
    );
    return (
      <Field
        {...commonProps}
        type={inputType}
        accept={field.type === "file" ? ".pdf,.jpg,.jpeg,.png" : undefined}
        multiple={field.type === "file" || undefined}
        value={values[field.id]}
      />
    );
  });
}
