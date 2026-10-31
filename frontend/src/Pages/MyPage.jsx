import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Membership.css";
import { AdminPanel } from "./Membership.jsx";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
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

export default function MyPage() {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [member, setMember] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request("/membership/me")
      .then((data) => setMember(data.member))
      .catch((sessionError) => {
        if (sessionError.status !== 401) setError(sessionError.message);
      });
  }, []);

  async function login(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await request("/membership/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      setMember(data.member);
      setCredentials({ email: "", password: "" });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await request("/membership/logout", { method: "POST", body: JSON.stringify({}) });
      setMember(null);
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  const profile = member?.profile || {};
  return (
    <main className="main-content membership-page">
      <p className="membership-eyebrow">Medlemsområde</p>
      <h1>Min side</h1>
      {member ? (
        <div className="my-page-auth-grid">
          <section className="membership-section my-page-member-panel">
            <h2>Velkommen, {profile.name || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email}</h2>
            <p>Medlemskapstype: {member.type === "minor" ? "Mindreårig" : member.type === "gift" ? "Gavemedlemskap" : "Vanlig medlem"}</p>
            {profile.region && <p>Region: {profile.region}</p>}
            {profile.chapter && <p>Lokallag: {profile.chapter}</p>}
            <button className="membership-secondary" type="button" onClick={logout}>Logg ut</button>
          </section>
          <section className="my-page-admin-panel" aria-label="Administratorinnlogging og -verktøy">
            <AdminPanel />
          </section>
        </div>
      ) : (
        <div className="my-page-auth-grid">
          <form className="membership-form admin-login my-page-member-panel" onSubmit={login}>
            <section className="membership-section">
              <h2>Medlemsinnlogging</h2>
              <div className="membership-grid">
                <label className="membership-field"><span>E-post</span><input type="email" autoComplete="username" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} required /></label>
                <label className="membership-field"><span>Passord</span><input type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} required /></label>
              </div>
            </section>
            {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
            <button className="membership-submit" disabled={busy}>{busy ? "Logger inn …" : "Logg inn"}</button>
            <p className="membership-note my-page-help-links">
              <Link to="/medlemskap?aktiver-gave=1">Mottatt medlemskap? Trykk her.</Link>
              <Link to="/medlemskap?type=craft">Blitt husflidhåndverker uten tidligere medlemskap? Trykk her.</Link>
            </p>
          </form>
          <section className="my-page-admin-panel" aria-label="Administratorinnlogging og -verktøy">
            <AdminPanel />
          </section>
        </div>
      )}
    </main>
  );
}
