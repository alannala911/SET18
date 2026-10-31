import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminMembers from "./AdminMembers.jsx";
import { API, request, useAdminSession } from "./MembershipApi.js";
import { configurableFields, configurableSections, createBuilderField, membershipTypes } from "./MembershipConfig.js";
import { BuilderFieldEditor } from "./MembershipBuilderFieldEditor.jsx";
import { Message, Section, TextAreaField } from "./MembershipFormFields.jsx";

function OfferTestPanel() {
  const [channel, setChannel] = useState("email");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function sendTest(event) {
    event.preventDefault();
    setError("");
    try {
      setResult(await request("/admin/offers/test", { method: "POST", body: JSON.stringify({ channel, message }) }));
    } catch (sendError) {
      setResult(null);
      setError(sendError.message);
    }
  }

  return (
    <form className="membership-form" onSubmit={sendTest}>
      <Section title="Test av tilbud og kampanjer" description="Dummy-utsending til medlemmer som har samtykket. Ingen e-post eller SMS blir faktisk sendt.">
        <label className="membership-field">
          <span>Kanal</span>
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="email">E-post</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <TextAreaField label="Melding" value={message} onChange={(event) => setMessage(event.target.value)} />
        <button className="membership-submit">Send test</button>
        <Message error={error} success={result?.message} />
        {result?.recipients.length > 0 && <ul>{result.recipients.map((contact) => <li key={contact}>{contact}</li>)}</ul>}
      </Section>
    </form>
  );
}

function AdminPanel() {
  const { authenticated, setAuthenticated, checking: checkingSession } = useAdminSession();
  const [config, setConfig] = useState(null);
  const [applications, setApplications] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [activationLinks, setActivationLinks] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (checkingSession || !authenticated) return undefined;
    let active = true;
    Promise.all([
      request("/admin/config"),
      request("/admin/applications"),
    ])
      .then(([settings, records]) => {
        if (!active) return;
        setConfig(settings.config || settings);
        setApplications(records.applications || []);
      })
      .catch((loadError) => {
        if (!active) return;
        if (loadError.status === 401) setAuthenticated(false);
        else setError(loadError.message);
      });
    return () => { active = false; };
  }, [authenticated, checkingSession, setAuthenticated]);

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

  function updateCustomForm(index, patch) {
    const customForms = [...editableConfig.customForms];
    customForms[index] = { ...customForms[index], ...patch };
    setConfig({ ...editableConfig, customForms });
  }

  function updateCustomForms(customForms) {
    setConfig({ ...editableConfig, customForms });
  }

  function updateSetting(group, flow, key, patch) {
    const setting = editableConfig[group]?.[flow]?.[key] || {};
    setConfig({
      ...editableConfig,
      [group]: {
        ...editableConfig[group],
        [flow]: {
          ...editableConfig[group]?.[flow],
          [key]: { ...setting, ...patch },
        },
      },
    });
  }

  if (checkingSession) return <p>Laster medlemskapsinnstillinger …</p>;
  if (!authenticated) return (
    <section className="membership-section membership-admin-locked">
      <h2>Administratorinnlogging kreves</h2>
      <Message error={error} />
      <p>Logg inn som administrator fra Min side for å redigere medlemskap og søknader.</p>
      <Link className="membership-submit membership-admin-back-link" to="/min-side">Gå til Min side</Link>
    </section>
  );

  const editableConfig = config && {
    ...config,
    regionsText: config.regionsText || (config.regions || []).map((item) => `${item.name}: ${(item.chapters || []).join(", ")}`).join("\n"),
    optionsText: config.optionsText || JSON.stringify(config.options || {}, null, 2),
  };
  return (
    <div className="membership-admin">
      <div className="membership-admin-heading"><h2>Medlemskap og søknader</h2><button className="membership-secondary" type="button" onClick={logout}>Logg ut</button></div>
      <Message error={error} />
      <AdminMembers />
      <OfferTestPanel />
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
                const update = (patch) => updateSetting("fields", flow, fieldKey, patch);
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
                const update = (patch) => updateSetting("sections", flow, title, patch);
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
                    updateCustomForm(formIndex, { name: event.target.value });
                  }} />
                </label>
                <label className="membership-check">
                  <input type="checkbox" checked={form.active} onChange={(event) => {
                    updateCustomForm(formIndex, { active: event.target.checked });
                  }} />
                  Aktivt på nettsiden
                </label>
                <label className="membership-check">
                  <input type="checkbox" checked={form.includeAgreements !== false} onChange={(event) => {
                    updateCustomForm(formIndex, { includeAgreements: event.target.checked });
                  }} />
                  Ta med vilkår og tilbudsvalg (e-post og SMS)
                </label>
                <label className="membership-field membership-grid-wide">
                  <span>Beskrivelse</span>
                  <textarea rows="3" maxLength={1000} value={form.description} onChange={(event) => {
                    updateCustomForm(formIndex, { description: event.target.value });
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
              { id: `custom_${suffix}`, name: "Nytt medlemskapsskjema", description: "", active: false, includeAgreements: true, fields: [] },
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

export function MembershipAdminPage() {
  return (
    <main className="main-content membership-page membership-admin-page">
      <Link className="membership-admin-back" to="/medlemskap">← Til medlemskap</Link>
      <p className="membership-eyebrow">Administrasjon</p>
      <h1>Rediger medlemskap</h1>
      <p className="membership-admin-intro">
        Administrer medlemskapsskjemaer, tilgjengelige felt og innsendte søknader fra ett sted.
      </p>
      <AdminPanel />
    </main>
  );
}
