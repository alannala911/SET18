import { useState } from "react";
import { FiMail, FiPhone, FiMapPin } from "react-icons/fi";
import "./Contact.css";

/* Kontaktopplysninger dere har samlet inn */
const board = [
  {
    name: "Mona Andersen",
    role: "Styreleder",
    email: "mona@sjokkpris.no",
    phone: "917 77 582",
  },
  {
    name: "Aud Kari Holme",
    role: "Nestleder",
    email: "Audkari.holme@gmail.com",
    phone: "958 79 367",
  },
  {
    name: "Heidi Børstad",
    role: "Sekretær",
    email: "heidi.borstad@gmail.com",
    phone: "952 22 155",
  },
  {
    name: "Silja Devine Holhjem",
    role: "Nettansvarlig",
    email: "siljadevine@gmail.com",
    phone: "416 64 904",
  },
  {
    name: "Linda P. Vallner",
    role: "Styremedlem · Ung Husflidskontakt",
    email: "lindap.vallner@gmail.com",
    phone: "97 63 84 24",
  },
  {
    name: "Thore Grøtvedt",
    role: "Styremedlem",
    email: "thoregro@gmail.com",
    phone: "901 35 455",
  },
  {
    name: "Julie Mari Brevik",
    role: "Varamedlem",
    email: "bunad.julie@gmail.com",
    phone: "993 13 244",
  },
];

export default function Contact() {
  const [status, setStatus] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    setStatus(
      "Feltene er fylt ut. Dette er en demo – meldingen er ikke sendt eller lagret."
    );
  }

  return (
    <main className="contact-page">
      {/* Introduksjon */}
      <header className="contact-intro">
        <p className="contact-label">
          Vi hører gjerne fra deg
        </p>

        <h1>Kontakt oss</h1>

        <p>
          Har du spørsmål om kurs, aktiviteter eller lokallag?
          Ta kontakt med oss.
        </p>
      </header>

      <section className="contact-layout">
        {/* Kontaktskjema */}
        <form
          className="contact-form"
          onSubmit={handleSubmit}
          onChange={() => setStatus("")}
          aria-labelledby="contact-form-heading"
        >
          <h2 id="contact-form-heading">Send oss en melding</h2>

          <p className="contact-notice" id="contact-demo-notice">
            Demo: Skjemaet sender ikke meldinger ennå.
            Bruk e-post eller telefon for å kontakte laget.
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
            required
          />

          <label htmlFor="contact-email">E-post *</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            required
          />

          <label htmlFor="contact-topic">Hva gjelder det? *</label>
          <select
            id="contact-topic"
            name="topic"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Velg tema
            </option>
            <option value="kurs">Kurs og påmelding</option>
            <option value="aktiviteter">Aktiviteter</option>
            <option value="lokallag">Lokallag og medlemskap</option>
            <option value="annet">Annet</option>
          </select>

          <label htmlFor="contact-message">Melding *</label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            maxLength={3000}
            placeholder="Skriv meldingen din her ..."
            required
          />

          <button
            type="submit"
            aria-describedby="contact-demo-notice"
          >
            Test skjemaet →
          </button>

          <p className="contact-status" role="status">
            {status}
          </p>
        </form>

        {/* Felles kontaktinformasjon */}
        <aside
          className="contact-information"
          aria-labelledby="contact-info-heading"
        >
          <h2 id="contact-info-heading">Kontaktinformasjon</h2>

          <section className="contact-detail">
            <FiMail aria-hidden="true" />

            <section>
              <h3>E-post</h3>
              <a href="mailto:ostfoldhusflid@gmail.com">
                ostfoldhusflid@gmail.com
              </a>
            </section>
          </section>

          <section className="contact-detail">
            <FiPhone aria-hidden="true" />

            <section>
              <h3>Telefon</h3>
              <a href="tel:+4791777582">917 77 582</a>
            </section>
          </section>

          <section className="contact-detail">
            <FiMapPin aria-hidden="true" />

            <section>
              <h3>Adresse</h3>
              <address>
                Emil Mørchs vei 25
                <br />
                2. etg., rom 1
                <br />
                1653 Sellebakk
              </address>
            </section>
          </section>

          <section className="contact-person">
            <h3>Kontaktperson</h3>
            <p>Mona Andersen</p>
          </section>
        </aside>
      </section>

      {/* Styret */}
      <section className="contact-board">
        <h2>Styret og kontaktpersoner</h2>

        <section className="contact-board-grid">
          {board.map((person) => (
            <article className="contact-person-card" key={person.email}>
              <p className="contact-role">{person.role}</p>
              <h3>{person.name}</h3>

              <a href={`mailto:${person.email}`}>
                <FiMail aria-hidden="true" />
                {person.email}
              </a>

              <a
                href={`tel:+47${person.phone.replaceAll(" ", "")}`}
              >
                <FiPhone aria-hidden="true" />
                {person.phone}
              </a>
            </article>
          ))}
        </section>

        <p className="contact-notice">
          Kontaktopplysningene er oppgitt av prosjektgruppen
          og må bekreftes før publisering.
        </p>
      </section>
    </main>
  );
}