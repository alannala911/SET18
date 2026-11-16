// Håndterer tilbakestilling av passord fra personlig lenke
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "./api.js";
import "./Membership.css";

const passwordFields = [
  ["password", "Nytt passord"],
  ["confirmPassword", "Bekreft nytt passord"],
];

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const token = searchParams.get("token") || "";

  function updatePassword(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passordene må være like.");
      return;
    }

    try {
      const result = await apiRequest("/membership/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, password: form.password }),
      });
      setMessage(result.message);
    } catch (resetError) {
      setError(resetError.message);
    }
  }

  if (message) {
    return (
      <main className="main-content membership-page">
        <h1>Velg nytt passord</h1>
        <p className="membership-alert membership-success" role="status">{message}</p>
        <Link to="/min-side">Gå til innlogging</Link>
      </main>
    );
  }

  return (
    <main className="main-content membership-page">
      <h1>Velg nytt passord</h1>
      <form className="membership-form" onSubmit={submit}>
        <section className="membership-section">
          {passwordFields.map(([field, label]) => (
            <label className="membership-field" key={field}>
              <span>{label} *</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form[field]}
                onChange={(event) => updatePassword(field, event.target.value)}
                required
              />
            </label>
          ))}
        </section>
        {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
        <button className="membership-submit">Lagre nytt passord</button>
        <p className="membership-note">* Obligatoriske felt: Må fylles ut</p>
      </form>
    </main>
  );
}
