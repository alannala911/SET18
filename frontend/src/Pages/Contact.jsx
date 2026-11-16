// Håndterer kontaktinnstillinger, kontaktpersoner og administratorinnboks
import { useCallback, useEffect, useState } from "react";
import { FiMail, FiMapPin, FiPhone, FiPlus, FiTrash2 } from "react-icons/fi";
import { apiRequest } from "./api.js";
import "./Contact.css";

const topicOptions = [
  ["kurs", "Kurs og påmelding"],
  ["aktiviteter", "Aktiviteter"],
  ["lokallag", "Lokallag og medlemskap"],
  ["annet", "Annet"],
];
const emptyContactSettings = {
  introduction: "",
  email: "",
  phone: "",
  address: "",
  people: [],
};
const emptyContactForm = { name: "", email: "", topic: "", message: "", website: "" };

function phoneLink(phone) {
  const trimmedPhone = phone.trim();
  const digits = trimmedPhone.replace(/\D/g, "");
  if (trimmedPhone.startsWith("+")) return `tel:+${digits}`;
  if (digits.length === 8) return `tel:+47${digits}`;
  return `tel:${digits}`;
}

function formatReceivedAt(date) {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsedDate);
}

export default function Contact() {
  const [settings, setSettings] = useState(emptyContactSettings);
  const [draft, setDraft] = useState(emptyContactSettings);
  const [messages, setMessages] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyContactForm);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadAdminMessages = useCallback(async () => {
    try {
      const adminMessages = await apiRequest("/contact/messages");
      setMessages(adminMessages);
    } catch (loadError) {
      if (loadError.status !== 401) setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadContactPage() {
      const loadedSettings = await apiRequest("/contact/settings");
      if (!isMounted) return;
      setSettings(loadedSettings);
      setDraft(loadedSettings);

      try {
        await apiRequest("/auth/me");
        if (!isMounted) return;
        setIsAdmin(true);
        const adminMessages = await apiRequest("/contact/messages");
        if (isMounted) setMessages(adminMessages);
      } catch (sessionError) {
        if (sessionError.status !== 401 && isMounted) {
          setError(sessionError.message);
        }
      }
    }

    loadContactPage()
      .catch((loadError) => {
        if (isMounted) setError(loadError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateForm(event) {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
    setStatus("");
    setError("");
  }

  function updateDraftField(event) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [event.target.name]: event.target.value,
    }));
  }

  function updatePerson(personId, field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      people: currentDraft.people.map((person) =>
        person.id === personId ? { ...person, [field]: value } : person,
      ),
    }));
  }

  function addPerson() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      people: [
        ...currentDraft.people,
        {
          id: crypto.randomUUID(),
          name: "",
          role: "",
          email: "",
          phone: "",
        },
      ],
    }));
  }

  function removePerson(personId) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      people: currentDraft.people.filter((person) => person.id !== personId),
    }));
  }

  async function submitMessage(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setStatus("");
    try {
      const result = await apiRequest("/contact", {
        method: "POST",
        body: form,
      });
      setStatus(result.message);
      setForm(emptyContactForm);
      if (isAdmin) await loadAdminMessages();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveContactSettings(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const savedSettings = await apiRequest("/contact/settings", {
        method: "PUT",
        body: draft,
      });
      setSettings(savedSettings);
      setDraft(savedSettings);
      setIsEditing(false);
      setStatus("Kontaktinformasjonen er lagret.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMessage(messageId) {
    setError("");
    try {
      await apiRequest(`/contact/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
      });
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== messageId),
      );
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function cancelEditing() {
    setDraft(settings);
    setIsEditing(false);
    setError("");
    setStatus("");
  }

  return (
    <main className="contact-page">
      <header className="contact-intro">
        <p className="contact-label">Vi hører gjerne fra deg</p>
        <h1>Kontakt oss</h1>
        <p>{settings.introduction}</p>
      </header>

      {isAdmin && (
        <section className="contact-admin-panel" aria-labelledby="contact-admin-heading">
          <div className="contact-admin-heading">
            <section>
              <p className="contact-label">Administrator</p>
              <h2 id="contact-admin-heading">Administrer kontaktinformasjon</h2>
            </section>
            {!isEditing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(settings);
                  setIsEditing(true);
                  setStatus("");
                }}
              >
                Rediger kontaktinformasjon
              </button>
            )}
          </div>
          {isEditing && error && (
            <p className="contact-error" role="alert">{error}</p>
          )}

          {isEditing && (
            <form className="contact-editor" onSubmit={saveContactSettings}>
              <h3>Felles kontaktinformasjon</h3>
              <label>
                <span>Introduksjon *</span>
                <textarea
                  name="introduction"
                  value={draft.introduction}
                  onChange={updateDraftField}
                  maxLength={500}
                  rows={3}
                  required
                />
              </label>
              <div className="contact-editor-grid">
                <label>
                  <span>E-post *</span>
                  <input
                    type="email"
                    name="email"
                    value={draft.email}
                    onChange={updateDraftField}
                    maxLength={254}
                    required
                  />
                </label>
                <label>
                  <span>Telefon *</span>
                  <input
                    type="tel"
                    name="phone"
                    value={draft.phone}
                    onChange={updateDraftField}
                    maxLength={30}
                    required
                  />
                </label>
              </div>
              <label>
                <span>Adresse *</span>
                <textarea
                  name="address"
                  value={draft.address}
                  onChange={updateDraftField}
                  maxLength={500}
                  rows={3}
                  required
                />
              </label>

              <div className="contact-people-editor-heading">
                <h3>Styret og kontaktpersoner</h3>
                <button type="button" className="contact-secondary-button" onClick={addPerson}>
                  <FiPlus aria-hidden="true" />
                  Legg til kontaktperson
                </button>
              </div>
              {draft.people.map((person, index) => (
                <fieldset className="contact-person-editor" key={person.id}>
                  <legend>Kontaktperson {index + 1}</legend>
                  <button
                    type="button"
                    className="contact-remove-person"
                    onClick={() => removePerson(person.id)}
                    aria-label={`Fjern ${person.name || `kontaktperson ${index + 1}`}`}
                  >
                    <FiTrash2 aria-hidden="true" />
                    Fjern
                  </button>
                  <div className="contact-editor-grid">
                    <label>
                      <span>Navn *</span>
                      <input
                        value={person.name}
                        onChange={(event) => updatePerson(person.id, "name", event.target.value)}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>
                      <span>Rolle *</span>
                      <input
                        value={person.role}
                        onChange={(event) => updatePerson(person.id, "role", event.target.value)}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      <span>E-post *</span>
                      <input
                        type="email"
                        value={person.email}
                        onChange={(event) => updatePerson(person.id, "email", event.target.value)}
                        maxLength={254}
                        required
                      />
                    </label>
                    <label>
                      <span>Telefon *</span>
                      <input
                        type="tel"
                        value={person.phone}
                        onChange={(event) => updatePerson(person.id, "phone", event.target.value)}
                        maxLength={30}
                        required
                      />
                    </label>
                  </div>
                </fieldset>
              ))}

              <div className="contact-admin-actions">
                <button type="button" className="contact-secondary-button" onClick={cancelEditing}>
                  Avbryt
                </button>
                <button type="submit" disabled={isSaving}>
                  {isSaving ? "Lagrer …" : "Lagre kontaktinformasjon"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="contact-layout">
        <form
          className="contact-form"
          onSubmit={submitMessage}
          aria-labelledby="contact-form-heading"
        >
          <h2 id="contact-form-heading">Send oss en melding</h2>
          <p className="contact-notice">
            Meldingen sendes til administratorene og kan besvares på e-post.
            Ikke skriv sensitive opplysninger.
          </p>
          <p>* Obligatoriske felt</p>

          <label htmlFor="contact-name">Navn *</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={form.name}
            onChange={updateForm}
            required
          />

          <label htmlFor="contact-email">E-post *</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={form.email}
            onChange={updateForm}
            required
          />

          <label htmlFor="contact-topic">Hva gjelder det? *</label>
          <select
            id="contact-topic"
            name="topic"
            value={form.topic}
            onChange={updateForm}
            required
          >
            <option value="" disabled>Velg tema</option>
            {topicOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label htmlFor="contact-message">Melding *</label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            maxLength={3000}
            placeholder="Skriv meldingen din her ..."
            value={form.message}
            onChange={updateForm}
            required
          />

          <label className="contact-honeypot" aria-hidden="true">
            Ikke fyll ut dette feltet
            <input
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={updateForm}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sender …" : "Send melding →"}
          </button>
          <p className="contact-status" role="status">{status}</p>
          {error && <p className="contact-error" role="alert">{error}</p>}
        </form>

        <aside className="contact-information" aria-labelledby="contact-info-heading">
          <h2 id="contact-info-heading">Kontaktinformasjon</h2>
          {isLoading ? (
            <p>Laster kontaktinformasjon …</p>
          ) : (
            <>
              <section className="contact-detail">
                <FiMail aria-hidden="true" />
                <section>
                  <h3>E-post</h3>
                  <a href={`mailto:${settings.email}`}>{settings.email}</a>
                </section>
              </section>
              <section className="contact-detail">
                <FiPhone aria-hidden="true" />
                <section>
                  <h3>Telefon</h3>
                  <a href={phoneLink(settings.phone)}>{settings.phone}</a>
                </section>
              </section>
              <section className="contact-detail">
                <FiMapPin aria-hidden="true" />
                <section>
                  <h3>Adresse</h3>
                  <address>
                    {settings.address.split("\n").map((line, index) => (
                      <span key={`${line}-${index}`}>{line}<br /></span>
                    ))}
                  </address>
                </section>
              </section>
            </>
          )}
        </aside>
      </section>

      {isAdmin && (
        <section className="contact-inbox" aria-labelledby="contact-inbox-heading">
          <div className="contact-admin-heading">
            <section>
              <p className="contact-label">Administrator</p>
              <h2 id="contact-inbox-heading">Meldinger fra kontaktskjemaet</h2>
            </section>
            <span>{messages.length} {messages.length === 1 ? "melding" : "meldinger"}</span>
          </div>
          {messages.length === 0 ? (
            <p>Det er ingen meldinger i innboksen.</p>
          ) : (
            <div className="contact-message-list">
              {messages.map((message) => (
                <article className="contact-message" key={message.id}>
                  <header>
                    <div>
                      <h3>{message.name}</h3>
                      <a href={`mailto:${message.email}`}>{message.email}</a>
                    </div>
                    <time dateTime={message.receivedAt}>
                      {formatReceivedAt(message.receivedAt)}
                    </time>
                  </header>
                  <p className="contact-role">
                    {topicOptions.find(([value]) => value === message.topic)?.[1] || message.topic}
                  </p>
                  <p>{message.message}</p>
                  <button
                    type="button"
                    className="contact-secondary-button"
                    onClick={() => deleteMessage(message.id)}
                  >
                    <FiTrash2 aria-hidden="true" />
                    Slett melding
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="contact-board">
        <h2>Styret og kontaktpersoner</h2>
        {isLoading ? (
          <p>Laster kontaktpersoner …</p>
        ) : settings.people.length ? (
          <section className="contact-board-grid">
            {settings.people.map((person) => (
              <article className="contact-person-card" key={person.id}>
                <p className="contact-role">{person.role}</p>
                <h3>{person.name}</h3>
                <a href={`mailto:${person.email}`}>
                  <FiMail aria-hidden="true" />
                  {person.email}
                </a>
                <a href={phoneLink(person.phone)}>
                  <FiPhone aria-hidden="true" />
                  {person.phone}
                </a>
              </article>
            ))}
          </section>
        ) : (
          <p>Det er ingen kontaktpersoner registrert.</p>
        )}
      </section>
      {status && <p className="contact-page-status" role="status">{status}</p>}
    </main>
  );
}
