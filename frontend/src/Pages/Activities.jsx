

import "./Activities.css";

export default function Activities() {
  return (
    <main className="activities-page">
      {/* Introduksjon */}
      <section className="activities-hero">
        <header>
          <p className="activities-label">
            Møt andre · skap noe sammen
          </p>

          <h1>Aktiviteter for alle</h1>

          <p className="activities-intro">
            Oppdag hyggelige møteplasser, håndarbeidstreff og
            kreative aktiviteter i Østfold.
          </p>

          <a className="activities-button" href="#kommende">
            Se kommende aktiviteter ↓
          </a>
        </header>

        <aside className="activities-symbols" aria-hidden="true">
          <span className="symbol-large">✣</span>
          <span className="symbol-small">✳</span>
          <span className="symbol-flower">✿</span>
        </aside>
      </section>

      {/* Kommende aktiviteter */}
      <section className="upcoming-activities" id="kommende">
        <header className="activities-heading">
          <section>
            <p className="activities-label">Hva skjer framover?</p>
            <h2>Kommende aktiviteter</h2>
          </section>

          <span className="activity-count">3 aktiviteter</span>
        </header>


        <section
          className="activity-list"
          aria-label="Kommende aktiviteter"
        >
          {/* Aktivitet 1 */}
          <article className="activity-card">
            <header className="activity-image activity-image-pink">
              <span aria-hidden="true">🧶</span>
              <small>Møt andre med samme interesse</small>
            </header>

            <section className="activity-content">
              <p className="activity-category">Sosialt treff</p>

              <h3>Husflidskafé</h3>

              <p>
                Ta med håndarbeidet ditt og bli kjent med andre som
                liker å skape noe.
              </p>

              <dl>
                <section>
                  <dt>Dato</dt>
                  <dd>7. november 2026</dd>
                </section>

                <section>
                  <dt>Tid</dt>
                  <dd>12:00–14:00</dd>
                </section>

                <section>
                  <dt>Sted</dt>
                  <dd>Fredrikstad</dd>
                </section>
              </dl>

              <button type="button">
                Les mer om aktiviteten +
              </button>
            </section>
          </article>

          {/* Aktivitet 2 */}
          <article className="activity-card">
            <header className="activity-image activity-image-yellow">
              <span aria-hidden="true">🪡</span>
              <small>Lær, del og prøv noe nytt</small>
            </header>

            <section className="activity-content">
              <p className="activity-category">Åpent verksted</p>

              <h3>Reparasjon og redesign</h3>

              <p>
                Få inspirasjon til å reparere klær og bruke tekstiler
                på nye måter.
              </p>

              <dl>
                <section>
                  <dt>Dato</dt>
                  <dd>18. november 2026</dd>
                </section>

                <section>
                  <dt>Tid</dt>
                  <dd>17:30–19:30</dd>
                </section>

                <section>
                  <dt>Sted</dt>
                  <dd>Moss</dd>
                </section>
              </dl>

              <button type="button">
                Les mer om aktiviteten +
              </button>
            </section>
          </article>

          {/* Aktivitet 3 */}
          <article className="activity-card">
            <header className="activity-image activity-image-green">
              <span aria-hidden="true">🎄</span>
              <small>Skap gode minner sammen</small>
            </header>

            <section className="activity-content">
              <p className="activity-category">Familieaktivitet</p>

              <h3>Juleverksted</h3>

              <p>
                En kreativ samling med enkle håndverksaktiviteter for
                store og små.
              </p>

              <dl>
                <section>
                  <dt>Dato</dt>
                  <dd>5. desember 2026</dd>
                </section>

                <section>
                  <dt>Tid</dt>
                  <dd>11:00–14:00</dd>
                </section>

                <section>
                  <dt>Sted</dt>
                  <dd>Halden</dd>
                </section>
              </dl>

              <button type="button">
                Les mer om aktiviteten +
              </button>
            </section>
          </article>
        </section>

        {/* Informasjon nederst */}
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
      </section>
    </main>
  );
}