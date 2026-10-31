import { createBuilderField, builderFieldTypes, presetFieldTypes } from "./MembershipConfig.js";

export function BuilderFieldEditor({ field, onChange, onRemove, allowFiles = true }) {
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
