import { useState } from "react";
import { Link } from "react-router-dom";
import { FiMapPin } from "react-icons/fi";
import "./Municipalities.css";

/* Eksempeldata – ikke en bekreftet oversikt over lokallag */
const municipalities = [
  "Halden",
  "Fredrikstad",
  "Sarpsborg",
  "Moss",
  "Råde",
  "Indre Østfold",
];

export default function Municipalities() {
  const [search, setSearch] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] =
    useState("Alle kommuner");

  /* Filtrerer listen etter søket og valgt kommune */
  const filteredMunicipalities = municipalities.filter((name) => {
    const matchesSearch = name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesSelection =
      selectedMunicipality === "Alle kommuner" ||
      name === selectedMunicipality;

    return matchesSearch && matchesSelection;
  });

  return (
    <main className="municipalities-page">
      {/* Introduksjon */}
      <header className="municipalities-intro">
        <p className="municipalities-label">Husflid nær deg</p>

        <h1>Kommuner og lokallag</h1>

        <p>
          Finn et husflidsmiljø nær deg og bli med på lokale
          aktiviteter.
        </p>
      </header>

      {/* Søk og kommunevalg */}
      <section
        className="municipalities-filters"
        aria-label="Søk og filtrering"
      >
        <label>
          <span>Søk etter kommune</span>

          <input
            type="search"
            placeholder="Skriv et kommunenavn ..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Velg kommune</span>

          <select
            value={selectedMunicipality}
            onChange={(event) =>
              setSelectedMunicipality(event.target.value)
            }
          >
            <option>Alle kommuner</option>

            {municipalities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <p className="municipalities-notice">
        Prototype: Oppføringene er eksempler. Navn på lokallag
        og kontaktinformasjon må bekreftes.
      </p>

      {/* Oversikten */}
      <section aria-labelledby="local-groups-heading">
        <header className="municipalities-heading">
          <h2 id="local-groups-heading">Finn ditt lokallag</h2>

          <p aria-live="polite">
            {filteredMunicipalities.length} eksempeloppføringer
          </p>
        </header>

        <section className="municipalities-grid">
          {filteredMunicipalities.map((name) => (
            <article className="municipality-card" key={name}>
              <FiMapPin
                className="municipality-icon"
                aria-hidden="true"
              />

              <h3>Lokallag i {name}</h3>

              <p>Håndverk og fellesskap i nærmiljøet.</p>

              <p className="municipality-contact">
                Kontaktinformasjon kommer
              </p>

              <details>
                <summary>Les mer</summary>

                <p>
                  Her vil du finne informasjon om lokallag,
                  møteplasser og aktiviteter i {name}.
                  Oppføringen er foreløpig et eksempel.
                </p>

                <Link to="/kontakt">
                  Spør oss om lokallag →
                </Link>
              </details>
            </article>
          ))}
        </section>

        {filteredMunicipalities.length === 0 && (
          <p className="municipalities-empty">
            Ingen treff. Prøv et annet søkeord eller velg
            «Alle kommuner».
          </p>
        )}
      </section>

      {/* Hjelp videre */}
      <aside className="municipalities-help">
        <section>
          <h2>Usikker på hvilket lag du skal velge?</h2>

          <p>
            Ta kontakt for hjelp med å finne riktig lokallag.
          </p>
        </section>

        <Link to="/kontakt">Kontakt oss →</Link>
      </aside>
    </main>
  );
}