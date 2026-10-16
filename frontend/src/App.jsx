import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="header">
        <a className="logo" href="/">
          <span className="logoMark">✦</span>

          <span>
            Østfold
            <br />
            Husflidslag
          </span>
        </a>
        
        <nav className="navigation" aria-label="Hovedmeny">
          <a href="#kurs">Kurs</a>
          <a href="#aktiviteter">Aktiviteter</a>
          <a href="#nyheter">Nyheter</a>
          <a href="#kontakt">Kontakt oss</a>
        </nav>

        <button className="memberButton">Min side</button>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Tradisjon · kreativitet · fellesskap</p>

          <h1>Velkommen til Østfold Husflidslag</h1>

          <p className="heroText">
            Oppdag lokale kurs, aktiviteter og arrangementer innen husflid
            og håndverk.
          </p>

          <div className="heroButtons">
            <a className="primaryButton" href="#kurs">
              Se våre kurs
            </a>

            <a className="secondaryButton" href="#aktiviteter">
              Se aktiviteter
            </a>
          </div>
        </section>

        <section className="contentGrid" aria-label="Snarveier">
          <article className="card" id="kurs">
            <p className="cardLabel">Lær noe nytt</p>
            <h2>Kurs</h2>
            <p>Finn kurs og utvikle ferdighetene dine sammen med andre.</p>
            <a href="#">Se alle kurs →</a>
          </article>

          <article className="card" id="aktiviteter">
            <p className="cardLabel">Bli med</p>
            <h2>Aktiviteter</h2>
            <p>Se møter, arrangementer og andre lokale aktiviteter.</p>
            <a href="#">Se aktiviteter →</a>
          </article>

          <article className="card" id="nyheter">
            <p className="cardLabel">Hold deg oppdatert</p>
            <h2>Nyheter</h2>
            <p>Få med deg det siste som skjer i Østfold Husflidslag.</p>
            <a href="#">Les nyheter →</a>
          </article>
        </section>
      </main>

      <footer className="footer" id="kontakt">
        <p>© 2026 Østfold Husflidslag</p>
        <a href="mailto:kontakt@eksempel.no">Kontakt oss</a>
      </footer>
    </div>
  );
}

export default App;