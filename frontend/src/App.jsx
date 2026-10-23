import "./App.css";

function App() {
  return (
    <>
      {/* Toppen av nettsiden */}
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-symbol" aria-hidden="true">
            ✣
          </span>

          <strong>
            Østfold
            <br />
            Husflidslag
          </strong>
        </a>

        <nav className="top-links" aria-label="Ekstra navigasjon">
          <a href="#sok">⌕ Søk</a>
          <a href="#butikk">🛒 Nettbutikk</a>
          <a href="#min-side">♙ Min side</a>
        </nav>
      </header>

      {/* Sidemeny og hovedinnhold */}
      <section className="page-layout">
        <aside className="sidebar">
          <nav className="side-links" aria-label="Hovedmeny">
            <a className="active" href="#">
              <span aria-hidden="true">⌂</span>
              Hjem
            </a>

            <a href="#kurs">
              <span aria-hidden="true">▣</span>
              Kurs
            </a>

            <a href="#aktiviteter">
              <span aria-hidden="true">☷</span>
              Aktiviteter
            </a>

            <a href="#nyheter">
              <span aria-hidden="true">▤</span>
              Nyheter
            </a>

            <a href="#om-oss">
              <span aria-hidden="true">●</span>
              Om oss
            </a>

            <a href="#kommuner">
              <span aria-hidden="true">♙</span>
              Kommuner
            </a>

            <a href="#kontakt">
              <span aria-hidden="true">✉</span>
              Kontakt oss
            </a>
          </nav>

          <section className="social">
            <h2>Følg oss</h2>

            <nav aria-label="Sosiale medier">
              <a href="#" aria-label="Facebook">
                f
              </a>

              <a href="#" aria-label="Instagram">
                ◎
              </a>
            </nav>
          </section>
        </aside>

        <main className="main-content">
          {/* Stort hovedområde */}
          <section className="hero">
            <p>Velkommen til</p>

            <h1>Østfold Husflidslag</h1>

            <p className="hero-description">
              Vi ivaretar og utvikler husflid og håndverk kulturelt, sosialt
              og økonomisk i Østfold.
            </p>

            <a className="hero-button" href="#kurs">
              Se våre kurs <span aria-hidden="true">→</span>
            </a>
          </section>

          {/* De fire informasjonskortene */}
          <section className="cards" aria-label="Snarveier">
            <article className="card course-card" id="kurs">
              <span className="card-icon" aria-hidden="true">
                K
              </span>

              <h2>Kurs</h2>

              <p>Lær nye teknikker og utvikle ferdighetene dine.</p>

              <a href="#kursoversikt">
                Se kurs <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className="card activity-card" id="aktiviteter">
              <span className="card-icon" aria-hidden="true">
                A
              </span>

              <h2>Aktiviteter</h2>

              <p>Bli med på arrangementer, møter og sosiale aktiviteter.</p>

              <a href="#aktivitetsoversikt">
                Se aktiviteter <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className="card news-card" id="nyheter">
              <span className="card-icon" aria-hidden="true">
                N
              </span>

              <h2>Nyheter</h2>

              <p>Få med deg det siste fra Østfold Husflidslag.</p>

              <a href="#nyhetsoversikt">
                Se nyheter <span aria-hidden="true">→</span>
              </a>
            </article>

            <article className="card local-card" id="kommuner">
              <span className="card-icon" aria-hidden="true">
                L
              </span>

              <h2>Lokale lag</h2>

              <p>Finn ditt nærmeste lokallag og se hva som skjer.</p>

              <a href="#lokallag">
                Se mer <span aria-hidden="true">→</span>
              </a>
            </article>
          </section>
        </main>
      </section>

      {/* Bunnen av nettsiden */}
      <footer className="footer" id="kontakt">
        <a className="brand" href="#">
          <span className="brand-symbol" aria-hidden="true">
            ✣
          </span>

          <strong>
            Østfold
            <br />
            Husflidslag
          </strong>
        </a>

        <p>Tradisjon · Kreativitet · Fellesskap</p>

        <nav aria-label="Kontakt og sosiale medier">
          <a href="#">Facebook</a>
          <a href="#">Instagram</a>
          <a href="mailto:kontakt@eksempel.no">Kontakt oss →</a>
        </nav>
      </footer>
    </>
  );
}

export default App;