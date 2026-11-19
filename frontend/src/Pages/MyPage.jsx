// Håndterer medlems- og administratorinnlogging og min side
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "./api.js";
import { Account } from "./MyPageAccount.jsx";
import { ForgotPassword } from "./AccountSecurity.jsx";
import "./Membership.css";

const jsonHeaders = { "Content-Type": "application/json" };

function getMemberName(member) {
  const profile = member.profile || {};
  const contact = profile.person || profile.child || profile.recipient || profile.applicant || {};
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "medlem";
}

function LoginForm({ credentials, onCredentialsChange, error, invalidCredentials, busy, onSubmit }) {
  function updateCredential(field, value) {
    onCredentialsChange((currentCredentials) => ({ ...currentCredentials, [field]: value }));
  }

  return (
    <div className="my-page-auth-grid">
      <form className="membership-form admin-login my-page-member-panel" onSubmit={onSubmit}>
        <section className="membership-section">
          <h2>Logg inn</h2>
          <div className="membership-grid">
            <label className="membership-field">
              <span>E-post</span>
              <input
                type="email"
                autoComplete="username"
                value={credentials.email}
                onChange={(event) => updateCredential("email", event.target.value)}
                required
              />
            </label>
            <label className="membership-field">
              <span>Passord</span>
              <input
                type="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(event) => updateCredential("password", event.target.value)}
                required
              />
            </label>
          </div>
        </section>
        {invalidCredentials ? (
          <p className="membership-alert membership-error" role="alert">
            Ugyldig e-post og/eller passord. Prøv igjen eller{" "}
            <Link className="my-page-invalid-login-link" to="/medlemskap">bli medlem</Link>.
          </p>
        ) : error && <p className="membership-alert membership-error" role="alert">{error}</p>}
        <button className="membership-submit" disabled={busy}>
          {busy ? "Logger inn …" : "Logg inn"}
        </button>
        <p className="membership-note my-page-help-links">
          <Link to="/medlemskap?aktiver-gave=1">Mottatt medlemskap? Trykk her.</Link>
          <Link to="/medlemskap?aktiver-mindreaarig-entry=1">Registrert bruker for mindreårig? Trykk her.</Link>
          <Link to="/medlemskap?aktiver-haandverker-entry=1">Blitt husflidhåndverker uten tidligere medlemskap? Trykk her.</Link>
        </p>
      </form>
      <ForgotPassword />
      <p className="membership-note">* Obligatoriske felt: Må fylles ut</p>
    </div>
  );
}

export default function MyPage() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [account, setAccount] = useState(null);
  const [regions, setRegions] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionRole, setSessionRole] = useState("");
  const [error, setError] = useState("");
  const [invalidCredentials, setInvalidCredentials] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        // Medlems- og administratorøkter er separate, så begge kontrolleres før riktig konto vises
        const [memberResult, adminResult] = await Promise.all([
          apiRequest("/membership/me", { headers: jsonHeaders }).catch((sessionError) => {
            if (sessionError.status === 401) return null;
            throw sessionError;
          }),
          apiRequest("/auth/me", { headers: jsonHeaders }).catch((sessionError) => {
            if (sessionError.status === 401) return null;
            throw sessionError;
          }),
        ]);
        if (!isMounted) return;

        const role = adminResult ? "admin" : memberResult?.member ? "member" : "";
        if (!role) return;

        setAccount(adminResult ? adminResult.admin : memberResult.member);
        setSessionRole(role);
        apiRequest("/membership/config", { headers: jsonHeaders })
          .then((config) => {
            if (isMounted) setRegions(config.regions || []);
          })
          .catch((configError) => {
            if (isMounted) setError(configError.message);
          });
      } catch (sessionError) {
        if (isMounted) setError(sessionError.message);
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    }

    checkSession();
    return () => { isMounted = false; };
  }, []);

  async function login(event) {
    event.preventDefault();
    setError("");
    setInvalidCredentials(false);
    setBusy(true);

    try {
      const loginOptions = {
        method: "POST",
        body: JSON.stringify(credentials),
        headers: jsonHeaders,
      };
      try {
        await apiRequest("/membership/login", loginOptions);
      } catch (memberLoginError) {
        // Medlemsinnlogging prøves først; bare 401 går videre til administratorinnlogging
        if (memberLoginError.status !== 401) throw memberLoginError;
        try {
          await apiRequest("/auth/login", loginOptions);
        } catch (adminLoginError) {
          if (adminLoginError.status === 401) {
            setInvalidCredentials(true);
            return;
          }
          throw adminLoginError;
        }
      }

      window.dispatchEvent(new Event("set18-auth-change"));
      setCredentials({ email: "", password: "" });
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  function saveLocalGroup(result) {
    setAccount(result.member || { ...account, profile: result.profile });
  }

  function logout() {
    setSessionRole("");
  }

  const pageHeading = (
    <>
      <p className="membership-eyebrow">Medlemsområde</p>
      <h1>Min side</h1>
    </>
  );

  if (checkingSession) {
    return (
      <main className="main-content membership-page">
        {pageHeading}
        <p>Kontrollerer innlogging …</p>
      </main>
    );
  }

  if (sessionRole) {
    return (
      <main className="main-content membership-page">
        {pageHeading}
        <Account
          title={sessionRole === "admin" ? "Du er logget inn som administrator" : `Velkommen, ${getMemberName(account)}`}
          apiBase={sessionRole === "admin" ? "/auth" : "/membership"}
          member={sessionRole === "member" ? account : null}
          onMemberUpdated={setAccount}
          isAdmin={sessionRole === "admin"}
          localGroup={account.profile?.localGroup || {}}
          regions={regions}
          onLocalGroupSaved={saveLocalGroup}
          onLogout={logout}
        />
        {error && <p className="membership-alert membership-error" role="alert">{error}</p>}
      </main>
    );
  }

  return (
    <main className="main-content membership-page">
      {pageHeading}
      <LoginForm
        credentials={credentials}
        onCredentialsChange={(updateCredentials) => {
          setCredentials(updateCredentials);
          setError("");
          setInvalidCredentials(false);
        }}
        error={error}
        invalidCredentials={invalidCredentials}
        busy={busy}
        onSubmit={login}
      />
    </main>
  );
}
