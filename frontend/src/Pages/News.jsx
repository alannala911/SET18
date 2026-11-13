
import { useState } from "react";

import bilde1 from "../assets/bilder til nettsiden/Ikoner og Bilder/Bilde1.jpg";
import bilde2 from "../assets/bilder til nettsiden/Ikoner og Bilder/Bilde2.jpg";
import bilde3 from "../assets/bilder til nettsiden/Ikoner og Bilder/Bilde3.jpg";

import "./News.css";

/* Eksempelnyheter */
const news = [
  {
    id: 1,
    title: "Skaperglede på tvers av generasjoner",
    image: bilde3,
    category: "Fra laget",
    date: "10. november 2026",
    summary:
      "Husflid samler mennesker i alle aldre gjennom håndverk og fellesskap.",
    text:
      "Når vi møtes rundt håndarbeidet, kan vi dele teknikker, erfaringer og ideer. Både nybegynnere og erfarne deltakere kan bidra med noe og lære av hverandre.",
  },
  {
    id: 2,
    title: "Tradisjonshåndverk i fokus",
    image: bilde1,
    category: "Fra laget",
    date: "3. november 2026",
    summary:
      "Gamle teknikker får nytt liv når kunnskapen deles videre.",
    text:
      "Vi ønsker å skape interesse for tradisjonelt håndverk. Gjennom praktiske aktiviteter kan flere bli kjent med materialer og teknikker som har blitt brukt gjennom generasjoner.",
  },
  {
    id: 3,
    title: "Et tilbakeblikk på høstens verksteder",
    image: bilde2,
    category: "Kurs og aktiviteter",
    date: "27. oktober 2026",
    summary:
      "Kreative verksteder gir rom for å prøve, lære og skape sammen.",
    text:
      "På et verksted kan deltakerne utforske nye teknikker og få hjelp underveis. Det viktigste er ikke å kunne alt fra før, men å ha lyst til å prøve.",
  },
  {
    id: 4,
    title: "Møteplasser for kreative hender",
    image: bilde3,
    category: "Kurs og aktiviteter",
    date: "20. oktober 2026",
    summary:
      "Håndarbeid gir gode møteplasser for læring og nye bekjentskaper.",
    text:
      "Ta med et prosjekt du holder på med, eller bli inspirert til å starte på noe nytt. En felles interesse for håndverk kan være starten på både samarbeid og vennskap.",
  },
];

const categories = [
  "Alle nyheter",
  "Fra laget",
  "Kurs og aktiviteter",
];

/* Nyhetskort */
function NewsCard({ item, featured = false }) {
  return (
    <article
      className={
        featured
          ? "news-card news-featured"
          : "news-card"
      }
    >
      <img
        src={item.image}
        alt=""
        loading="lazy"
      />

      <section className="news-card-content">

        <p className="news-meta">
          {item.category} · {item.date}
        </p>

        <h2>{item.title}</h2>

        <p className="news-summary">
          {item.summary}
        </p>

        <details>
          <summary>Les mer</summary>

          <p className="news-text">
            {item.text}
          </p>
        </details>

      </section>
    </article>
  );
}

export default function News() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle nyheter");

  /* Søker gjennom tittel, ingress og tekst */
  const filteredNews = news.filter((item) => {

    const searchText = `
      ${item.title}
      ${item.summary}
      ${item.text}
    `.toLowerCase();

    const matchesSearch = searchText.includes(
      search.trim().toLowerCase()
    );

    const matchesCategory =
      category === "Alle nyheter" ||
      item.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <main className="news-page">

      {/* Introduksjon */}
      <header className="news-intro">

        <p className="news-label">
          Fra Østfold Husflidslag
        </p>

        <h1>Nyheter</h1>

        <p>
          Små og store nyheter fra husflidsmiljøet i Østfold.
        </p>

      </header>

      {/* Søk og filtrering */}
      <section
        className="news-tools"
        aria-label="Søk og filtrering"
      >

        <label className="news-search">

          <span>Søk i nyheter</span>

          <input
            type="search"
            placeholder="Skriv et søkeord ..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </label>

        <nav
          className="news-filters"
          aria-label="Nyhetskategorier"
        >

          {categories.map((name) => (

            <button
              key={name}
              type="button"
              className={
                category === name ? "selected" : ""
              }
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>

          ))}

        </nav>

      </section>

      {/* Antall nyheter */}
      <p className="news-count" aria-live="polite">
        Viser {filteredNews.length} av {news.length} nyheter
      </p>

      {/* Eksempelinnhold */}
      <p className="news-notice">
        Prototype: Nyhetene nedenfor er eksempelinnhold.
      </p>

      {/* Nyheter */}
      {filteredNews.length > 0 ? (
        <>
          {/* Første nyhet - fremhevet */}
          <NewsCard
            item={filteredNews[0]}
            featured
          />

          {/* Flere nyheter */}
          {filteredNews.length > 1 && (
            <section className="news-more">

              <h2>Flere nyheter</h2>

              <section className="news-grid">

                {filteredNews.slice(1).map((item) => (

                  <NewsCard
                    key={item.id}
                    item={item}
                  />

                ))}

              </section>

            </section>
          )}
        </>
      ) : (

        /* Hvis ingen nyheter passer med søket */
        <div className="news-empty">

          <h2>Ingen nyheter funnet</h2>

          <p>
            Ingen nyheter passer med søket ditt.
            Prøv et annet søkeord eller velg en annen kategori.
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("Alle nyheter");
            }}
          >
            Vis alle nyheter
          </button>

        </div>

      )}

    </main>
  );
}
