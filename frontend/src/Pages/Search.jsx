import { useState } from "react";
import { Link } from "react-router-dom";
import "./Search.css";

/* Sidene det er mulig å søke etter */
const pages = [
  {
    title: "Kurs",
    description: "Finn kurs i strikking, søm, toving og annet håndverk.",
    path: "/kurs",
  },
  {
    title: "Aktiviteter",
    description: "Se arrangementer, håndarbeidstreff og møteplasser.",
    path: "/aktiviteter",
  },
  {
    title: "Nyheter",
    description: "Les siste nytt fra Østfold Husflidslag.",
    path: "/nyheter",
  },
  {
    title: "Om oss",
    description: "Bli kjent med Østfold Husflidslag og arbeidet vårt.",
    path: "/om-oss",
  },
  {
    title: "Kommuner og lokallag",
    description: "Finn lokale husflidslag i området ditt.",
    path: "/kommuner",
  },
  {
    title: "Kontakt oss",
    description: "Finn telefon, e-post, adresse og kontaktpersoner i styret.",
    path: "/kontakt",
  },
  {
    title: "Medlemskap",
    description: "Finn informasjon om å bli medlem.",
    path: "/medlemskap",
  },
];

export default function Search() {
  const [search, setSearch] = useState("");
  const searchText = search.trim().toLowerCase();

  const results = pages.filter((page) => {
    const text = `${page.title} ${page.description}`.toLowerCase();
    return text.includes(searchText);
  });

  return (
    <main className="search-page">
      <header className="search-intro">
        <h1>Søk på nettsiden</h1>
        <p>Finn kurs, aktiviteter og informasjon fra Husflidslaget.</p>
      </header>

      <section className="search-field">
        <label htmlFor="site-search">Hva leter du etter?</label>

        <input
          id="site-search"
          type="search"
          placeholder="Søk etter for eksempel kurs eller kontakt ..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>

      <p className="search-count" role="status">
        {searchText
          ? `${results.length} treff på «${search.trim()}»`
          : "Velg en side nedenfor, eller skriv i søkefeltet."}
      </p>

      <ul className="search-results">
        {results.map((page) => (
          <li key={page.path}>
            <h2>{page.title}</h2>
            <p>{page.description}</p>
            <Link to={page.path}>Gå til {page.title.toLowerCase()} →</Link>
          </li>
        ))}
      </ul>

      {results.length === 0 && (
        <p className="search-empty">
          Ingen treff. Prøv et annet søkeord.
        </p>
      )}
    </main>
  );
}