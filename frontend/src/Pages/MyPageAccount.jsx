// Håndterer kontooversikt, profiloppdatering og kontohandlinger
import { useState } from "react";
import { AdminAccounts, ChangePassword, DeleteAccount, MembershipSettings } from "./AccountSecurity.jsx";
import { MemberOrders } from "./ActivityTickets.jsx";
import { apiRequest } from "./api.js";

function LocalGroupEditor({ apiBase, currentGroup, regions, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [region, setRegion] = useState(currentGroup.region || "");
  const [chapter, setChapter] = useState(currentGroup.chapter || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Lokallagslisten avhenger av region, så regionbytte nullstiller valgt lokallag
  const chapters = regions.find((item) => item.name === region)?.chapters || [];

  async function saveLocalGroup(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await apiRequest(`${apiBase}/me/local-group`, {
        method: "PATCH",
        body: JSON.stringify({ region, chapter }),
      });
      onSaved(result);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="membership-section my-page-actions">
      <button className="membership-secondary" type="button" onClick={() => setIsEditing(!isEditing)} disabled={!regions.length}>
        {isEditing ? "Avbryt endring av lokallag" : "Endre lokallag"}
      </button>
      {isEditing && (
        <form className="membership-form" onSubmit={saveLocalGroup}>
          <div className="membership-grid">
            <label className="membership-field">
              <span>Region</span>
              <select value={region} onChange={(event) => {
                setRegion(event.target.value);
                setChapter("");
              }} required>
                <option value="">Velg region</option>
                {regions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label className="membership-field">
              <span>Lokallag</span>
              <select value={chapter} onChange={(event) => setChapter(event.target.value)} required disabled={!region}>
                <option value="">Velg lokallag</option>
                {chapters.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
          <button className="membership-submit" disabled={busy}>{busy ? "Lagrer …" : "Lagre lokallag"}</button>
        </form>
      )}
    </section>
  );
}

export function Account({ title, apiBase, member, isAdmin, onMemberUpdated, localGroup, regions, onLocalGroupSaved, onLogout }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendProfileChangeLink() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      // Personopplysninger endres via en tidsbegrenset e-postlenke i stedet for direkte i nettleseren
      const result = await apiRequest(`${apiBase}/profile/change-request`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError("");
    try {
      await apiRequest(`${apiBase}/logout`, { method: "POST", body: JSON.stringify({}) });
      window.dispatchEvent(new Event("set18-auth-change"));
      onLogout();
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  return (
    <section className="membership-section my-page-member-panel">
      <h2>{title}</h2>
      {localGroup.region && <p>Region: {localGroup.region}</p>}
      {localGroup.chapter && <p>Lokallag: {localGroup.chapter}</p>}
      <div className="my-page-account-actions">
        <button className="membership-submit" type="button" onClick={sendProfileChangeLink} disabled={busy}>
          {busy ? "Sender e-post …" : "Endre personopplysninger"}
        </button>
        <LocalGroupEditor apiBase={apiBase} currentGroup={localGroup} regions={regions} onSaved={onLocalGroupSaved} />
      </div>
      {message && <p className="membership-alert membership-success" role="status">{message}</p>}
      {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
      {member && <MembershipSettings member={member} onUpdated={onMemberUpdated} />}
      {member && <MemberOrders />}
      <ChangePassword apiBase={apiBase} />
      {isAdmin && <AdminAccounts />}
      {member && <DeleteAccount onDeleted={onLogout} />}
      <button className="membership-secondary" type="button" onClick={logout}>Logg ut</button>
      <p className="membership-note">* Obligatoriske felt: Må fylles ut</p>
    </section>
  );
}
