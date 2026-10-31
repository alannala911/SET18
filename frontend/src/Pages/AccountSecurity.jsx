import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api.js";

function postJson(body) {
  return { method: "POST", body: JSON.stringify(body) };
}

function updateField(setForm, field, value) {
  setForm((currentForm) => ({ ...currentForm, [field]: value }));
}

function Feedback({ message, error }) {
  return (
    <>
      {message && <p className="membership-alert membership-success" role="status">{message}</p>}
      {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
    </>
  );
}

function PasswordField({ label, value, onChange, autoComplete }) {
  return (
    <label className="membership-field">
      <span>{label} *</span>
      <input
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function useAction() {
  const [actionState, setActionState] = useState({ message: "", error: "", busy: false });

  async function runAction(action) {
    setActionState({ message: "", error: "", busy: true });
    try {
      const message = await action();
      setActionState({ message, error: "", busy: false });
    } catch (actionError) {
      setActionState({ message: "", error: actionError.message, busy: false });
    }
  }

  return [actionState, runAction];
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [{ message, error, busy }, runAction] = useAction();

  function submit(event) {
    event.preventDefault();
    runAction(async () => {
      const result = await apiRequest("/membership/password/forgot", postJson({ email }));
      return result.message;
    });
  }

  return (
    <form className="membership-section" onSubmit={submit}>
      <h2>Glemt passord</h2>
      <label className="membership-field">
        <span>E-post *</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <button className="membership-secondary" disabled={busy}>
        {busy ? "Sender …" : "Send lenke for nytt passord"}
      </button>
      <Feedback message={message} error={error} />
    </form>
  );
}

export function ChangePassword({ apiBase }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [{ message, error, busy }, runAction] = useAction();

  function submit(event) {
    event.preventDefault();
    runAction(async () => {
      if (form.newPassword !== form.confirmPassword) {
        throw new Error("Passordene må være like.");
      }

      const result = await apiRequest(`${apiBase}/me/password`, postJson(form));
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      return result.message;
    });
  }

  return (
    <form className="membership-section" onSubmit={submit}>
      <h3>Endre passord</h3>
      {[
        ["currentPassword", "Nåværende passord", "current-password"],
        ["newPassword", "Nytt passord", "new-password"],
        ["confirmPassword", "Bekreft nytt passord", "new-password"],
      ].map(([field, label, autoComplete]) => (
        <PasswordField
          key={field}
          label={label}
          value={form[field]}
          onChange={(value) => updateField(setForm, field, value)}
          autoComplete={autoComplete}
        />
      ))}
      <button className="membership-secondary" disabled={busy}>
        {busy ? "Lagrer …" : "Endre passord"}
      </button>
      <Feedback message={message} error={error} />
    </form>
  );
}

export function DeleteAccount({ onDeleted }) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [{ error, busy }, runAction] = useAction();

  function submit(event) {
    event.preventDefault();
    runAction(async () => {
      await apiRequest("/membership/me", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      window.dispatchEvent(new Event("set18-auth-change"));
      onDeleted();
      return "";
    });
  }

  if (!isOpen) {
    return (
      <button className="membership-secondary" type="button" onClick={() => setIsOpen(true)}>
        Slett medlemskap
      </button>
    );
  }

  return (
    <form className="membership-section" onSubmit={submit}>
      <h3>Slett medlemskap</h3>
      <p>Medlemskapet og alle opplysninger slettes, og kommende bestillinger avbestilles. Dette kan ikke angres.</p>
      <PasswordField
        label="Bekreft med passord"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <button className="membership-submit" disabled={busy}>
        {busy ? "Sletter …" : "Slett permanent"}
      </button>
      <button className="membership-secondary" type="button" onClick={() => setIsOpen(false)}>
        Avbryt
      </button>
      <Feedback error={error} />
    </form>
  );
}

export function AdminAccounts() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ email: "", password: "" });
  const [{ message, error, busy }, runAction] = useAction();
  const loadAdmins = useCallback(
    () => apiRequest("/auth/admins").then(setAdmins).catch(() => setAdmins([])),
    [],
  );

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  function addAdmin(event) {
    event.preventDefault();
    runAction(async () => {
      await apiRequest("/auth/admins", postJson(form));
      setForm({ email: "", password: "" });
      await loadAdmins();
      return "Administratoren er lagt til.";
    });
  }

  function removeAdmin(admin) {
    runAction(async () => {
      await apiRequest(`/auth/admins/${admin.id}`, { method: "DELETE" });
      await loadAdmins();
      return "Administratoren er fjernet.";
    });
  }

  return (
    <section className="membership-section">
      <h3>Administratorer</h3>
      <ul>
        {admins.map((admin) => (
          <li key={admin.id}>
            {admin.email} ({admin.role === "owner" ? "hovedadministrator" : "administrator"})
            {admin.role !== "owner" && (
              <button type="button" onClick={() => removeAdmin(admin)} disabled={busy}>Fjern</button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={addAdmin}>
        <label className="membership-field">
          <span>E-post for ny administrator *</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField(setForm, "email", event.target.value)}
            required
          />
        </label>
        <PasswordField
          label="Midlertidig passord"
          value={form.password}
          onChange={(value) => updateField(setForm, "password", value)}
          autoComplete="new-password"
        />
        <button className="membership-secondary" disabled={busy}>Legg til administrator</button>
      </form>
      <Feedback message={message} error={error} />
    </section>
  );
}

const consentOptions = [
  ["emailOffers", "Jeg ønsker å få tilsendt e-post om tilbud og kampanjer hos Norges Husflidslag"],
  ["smsOffers", "Jeg ønsker å få tilsendt SMS om tilbud og kampanjer hos Norges Husflidslag"],
];

export function MembershipSettings({ member, onUpdated }) {
  const [offers, setOffers] = useState({
    emailOffers: member.profile?.emailOffers === true,
    smsOffers: member.profile?.smsOffers === true,
  });
  const [{ message, error, busy }, runAction] = useAction();

  function saveSettings(path, method, body, successMessage) {
    runAction(async () => {
      const result = await apiRequest(path, { method, body: JSON.stringify(body) });
      onUpdated(result.member);
      return successMessage;
    });
  }

  return (
    <section className="membership-section">
      <h3>Medlemskap</h3>
      <p>
        Gyldig til: {member.validUntil} {member.expired && <strong>(utløpt)</strong>}
      </p>
      <button
        className="membership-secondary"
        type="button"
        disabled={busy}
        onClick={() => saveSettings("/membership/me/renew", "POST", {}, "Medlemskapet er fornyet.")}
      >
        Forny medlemskap
      </button>
      {consentOptions.map(([field, label]) => (
        <label className="membership-checkbox" key={field}>
          <input
            type="checkbox"
            checked={offers[field]}
            onChange={(event) => updateField(setOffers, field, event.target.checked)}
          />
          {" "}{label}
        </label>
      ))}
      <button
        className="membership-secondary"
        type="button"
        disabled={busy}
        onClick={() => saveSettings("/membership/me/consents", "PATCH", offers, "Samtykkene er lagret.")}
      >
        Lagre samtykker
      </button>
      <Feedback message={message} error={error} />
    </section>
  );
}
