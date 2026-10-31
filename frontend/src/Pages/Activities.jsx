import { useCallback, useEffect, useState } from "react";
import "./Activities.css";

const API = import.meta.env.VITE_API_BASE_URL || "/api";
const activityDecorations = {
  1: { emoji: "🧶", color: "pink", tagline: "Møt andre med samme interesse" },
  2: { emoji: "🪡", color: "yellow", tagline: "Lær, del og prøv noe nytt" },
  3: { emoji: "🎄", color: "green", tagline: "Skap gode minner sammen" },
};
const fallbackColors = ["pink", "yellow", "green"];

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

function formatActivityDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(date);
}

function RemoveActivityDialog({ activity, stage, busy, onCancel, onConfirm }) {
  if (!activity) return null;
  const finalConfirmation = stage === 2;
  return (
    <div className="activity-dialog-backdrop">
      <section
        className="activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-dialog-title"
        aria-describedby="activity-dialog-description"
      >
        <h2 id="activity-dialog-title">{finalConfirmation ? "Er du sikker? Denne handlingen kan ikke angres" : "Ønsker du å fjerne denne aktiviteten?"}</h2>
        <p id="activity-dialog-description">
          {finalConfirmation
            ? `Aktiviteten «${activity.title}» blir fjernet permanent.`
            : `Vil du fjerne «${activity.title}» fra kommende aktiviteter?`}
        </p>
        <div className="activity-dialog-actions">
          <button type="button" className="activity-dialog-no" onClick={onCancel} disabled={busy}>Nei</button>
          <button type="button" className="activity-dialog-yes" onClick={onConfirm} disabled={busy}>
            {busy ? "Fjerner …" : "Ja"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [dialogActivity, setDialogActivity] = useState(null);
  const [dialogStage, setDialogStage] = useState(1);
  const [busy, setBusy] = useState(false);

  const checkAdmin = useCallback(async () => {
    try {
      await request("/auth/me");
      setIsAdmin(true);
    } catch (error) {
      setIsAdmin(false);
      if (error.status !== 401) setActionError(error.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([request("/activities"), request("/auth/me").catch((error) => {
      if (error.status !== 401) throw error;
      return null;
    })])
      .then(([result, admin]) => {
        if (!active) return;
        if (!Array.isArray(result)) throw new Error("Aktivitetslisten har et ugyldig format.");
        setActivities(result);
        setIsAdmin(Boolean(admin));
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    window.addEventListener("set18-auth-change", checkAdmin);
    return () => {
      active = false;
      window.removeEventListener("set18-auth-change", checkAdmin);
    };
  }, [checkAdmin]);

  function beginRemoval(activity) {
    setActionError("");
    setDialogActivity(activity);
    setDialogStage(1);
  }

  async function confirmRemoval() {
    if (!dialogActivity) return;
    if (dialogStage === 1) {
      setDialogStage(2);
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await request(`/activities/${encodeURIComponent(dialogActivity.id)}`, { method: "DELETE" });
      setActivities((current) => current.filter((activity) => activity.id !== dialogActivity.id));
      setDialogActivity(null);
      setDialogStage(1);
    } catch (error) {
      setActionError(error.message);
      setDialogActivity(null);
      setDialogStage(1);
    } finally {
      setBusy(false);
    }
  }

  function cancelRemoval() {
    if (busy) return;
    setDialogActivity(null);
    setDialogStage(1);
  }

  return (
    <main className="activities-page">
      <section className="activities-hero">
        <header>
          <p className="activities-label">Møt andre · skap noe sammen</p>
          <h1>Aktiviteter for alle</h1>
          <p className="activities-intro">
            Oppdag hyggelige møteplasser, håndarbeidstreff og
            kreative aktiviteter i Østfold.
          </p>
          <a className="activities-button" href="#kommende">Se kommende aktiviteter ↓</a>
        </header>

        <aside className="activities-symbols" aria-hidden="true">
          <span className="symbol-large">✣</span>
          <span className="symbol-small">✳</span>
          <span className="symbol-flower">✿</span>
        </aside>
      </section>

      <section className="upcoming-activities" id="kommende">
        <header className="activities-heading">
          <section>
            <p className="activities-label">Hva skjer framover?</p>
            <h2>Kommende aktiviteter</h2>
          </section>
          <span className="activity-count">
            {activities.length} {activities.length === 1 ? "aktivitet" : "aktiviteter"}
          </span>
        </header>

        {loadError && <p className="activity-error" role="alert">{loadError}</p>}
        {actionError && <p className="activity-error" role="alert">{actionError}</p>}
        {loading ? (
          <p className="activities-empty">Laster aktiviteter …</p>
        ) : activities.length === 0 ? (
          <p className="activities-empty">Det er ingen kommende aktiviteter å vise.</p>
        ) : (
          <section className="activity-list" aria-label="Kommende aktiviteter">
            {activities.map((activity, index) => {
              const decoration = activityDecorations[activity.id] || {
                emoji: "✣",
                color: fallbackColors[index % fallbackColors.length],
                tagline: activity.category || "Aktivitet",
              };
              return (
                <article className="activity-card" key={activity.id}>
                  {editing && isAdmin && (
                    <button
                      className="activity-remove-button"
                      type="button"
                      aria-label={`Fjern ${activity.title}`}
                      onClick={() => beginRemoval(activity)}
                    >
                      ×
                    </button>
                  )}
                  <header className={`activity-image activity-image-${decoration.color}`}>
                    <span aria-hidden="true">{decoration.emoji}</span>
                    <small>{decoration.tagline}</small>
                  </header>
                  <section className="activity-content">
                    <p className="activity-category">{activity.category || "Aktivitet"}</p>
                    <h3>{activity.title}</h3>
                    <p>{activity.description}</p>
                    <dl>
                      <section>
                        <dt>Dato</dt>
                        <dd>{formatActivityDate(activity.date)}</dd>
                      </section>
                      <section>
                        <dt>Tid</dt>
                        <dd>{activity.time}</dd>
                      </section>
                      <section>
                        <dt>Sted</dt>
                        <dd>{activity.location}</dd>
                      </section>
                    </dl>
                    <button type="button">Les mer om aktiviteten +</button>
                  </section>
                </article>
              );
            })}
          </section>
        )}

        <aside className="activities-information">
          <span aria-hidden="true">♥</span>
          <section>
            <h2>Alle skal kunne finne noe som passer</h2>
            <p>
              Aktivitetssiden er laget for å gjøre det enkelt å se
              hva som skjer, hvor det skjer og når du kan delta.
            </p>
          </section>
        </aside>
        {isAdmin && (
          <button
            className="activities-edit-button"
            type="button"
            onClick={() => {
              setActionError("");
              setEditing((current) => !current);
            }}
          >
            {editing ? "Avslutt redigering" : "Rediger aktiviteter"}
          </button>
        )}
      </section>
      <RemoveActivityDialog
        activity={dialogActivity}
        stage={dialogStage}
        busy={busy}
        onCancel={cancelRemoval}
        onConfirm={confirmRemoval}
      />
    </main>
  );
}
