import { Link } from "react-router-dom";
import { FiHeart, FiScissors, FiUsers } from "react-icons/fi";
import aboutImage from "../assets/bilder til nettsiden/hero-husflid.jpg";
import "./About.css";

export default function About() {
  return (
    <main className="about-page">
      {/* Introduksjon */}
      <header className="about-intro">
        <p className="about-label">
          Tradisjon · kreativitet · fellesskap
        </p>

        <h1>Om Østfold Husflidslag</h1>

        <p>
          Vi skaper møteplasser for håndverk, læring og
          fellesskap i Østfold.
        </p>
      </header>

      {/* Tekst og bilde */}
      <section className="about-story">
        <section>
          <h2>Håndverk som bringer oss sammen</h2>

          <p>
            Husflid handler om å skape med hendene og dele
            kunnskap med andre.
          </p>

          <p>
            Vi ønsker å gjøre tradisjonelle teknikker og
            skaperglede tilgjengelig for både nye og erfarne
            håndverksinteresserte.
          </p>
        </section>

        <img
          src={aboutImage}
          alt="Hender som arbeider med tradisjonelt tekstilhåndverk"
        />
      </section>

      {/* Tre fokusområder */}
      <section className="about-values">
        <h2>Dette ønsker vi å bidra til</h2>

        <section className="about-grid">
          <article className="about-card">
            <FiHeart aria-hidden="true" />

            <h3>Ta vare på tradisjoner</h3>

            <p>
              Vi deler kunnskap og holder håndverksteknikker
              levende.
            </p>
          </article>

          <article className="about-card">
            <FiScissors aria-hidden="true" />

            <h3>Lære og skape</h3>

            <p>
              Vi gir rom for å prøve nye teknikker og utvikle
              ferdigheter.
            </p>
          </article>

          <article className="about-card">
            <FiUsers aria-hidden="true" />

            <h3>Bygge fellesskap</h3>

            <p>
              Vi ønsker møteplasser der alle kan føle seg
              velkomne.
            </p>
          </article>
        </section>
      </section>

      {/* Lenker videre */}
      <section className="about-join">
        <h2>Finn din plass i husflidsmiljøet</h2>

        <p>
          Utforsk kursene våre eller finn et lokallag nær deg.
        </p>

        <nav className="about-buttons" aria-label="Utforsk tilbudet vårt">
          <Link className="about-primary" to="/kurs">
            Se våre kurs →
          </Link>

          <Link className="about-secondary" to="/kommuner">
            Finn lokallag →
          </Link>
        </nav>
      </section>
    </main>
  );
}