import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "./api.js";
import { buildSearchIndex, findSearchResults } from "./searchIndex.js";
import "./Search.css";

const sources = [
  ["courses", "kurs", "/courses"],
  ["activities", "aktiviteter", "/activities"],
  ["news", "nyheter", "/news"],
  ["contact", "kontaktinformasjon", "/contact/settings"],
  ["membership", "medlemskapsskjemaer", "/membership/config"],
];

function plainText(value) {
  const html = value.replace(/<\/(?:p|li|h[1-6])\s*>|<br\s*\/?>/gi, "$& ");
  return new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ").trim();
}

function Highlight({ value, term, excerpt = false }) {
  const lowered = value.toLocaleLowerCase("nb-NO");
  const query = term.toLocaleLowerCase("nb-NO");
  const first = lowered.indexOf(query);
  if (first < 0) return value;
  const start = excerpt ? Math.max(0, first - 80) : 0;
  const end = excerpt ? Math.min(value.length, first + query.length + 80) : value.length;
  const parts = [];
  let position = start;
  let index = lowered.indexOf(query, position);
  while (index >= 0 && index < end) {
    parts.push(value.slice(position, index));
    parts.push(<mark key={index}>{value.slice(index, index + query.length)}</mark>);
    position = index + query.length;
    index = lowered.indexOf(query, position);
  }
  parts.push(value.slice(position, end));
  return <>{start > 0 && "…"}{parts}{end < value.length && "…"}</>;
}

export default function Search() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState([]);
  useEffect(() => {
    let active = true;
    Promise.allSettled(sources.map(async ([key, , path]) => {
      const result = await apiRequest(path, { credentials: "omit" });
      if (["courses", "activities", "news"].includes(key) ? !Array.isArray(result) : !result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("Ugyldig svar fra serveren.");
      }
      return result;
    })).then((responses) => {
      if (!active) return;
      setData(Object.fromEntries(responses.flatMap((response, index) =>
        response.status === "fulfilled" ? [[sources[index][0], response.value]] : [])));
      setFailedSources(responses.flatMap((response, index) =>
        response.status === "rejected" ? [sources[index][1]] : []));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const searchText = search.trim();
  const index = useMemo(() => buildSearchIndex({ ...data, htmlToText: plainText }), [data]);
  const results = useMemo(() => findSearchResults(index, searchText), [index, searchText]);
  const groups = results.reduce((grouped, result) => {
    (grouped[result.category] ??= []).push(result);
    return grouped;
  }, {});

  return (
    <main className="search-page">
      <header className="search-intro">
        <h1>Søk på nettsiden</h1>
        <p>Finn kurs, aktiviteter og informasjon fra Husflidslaget.</p>
      </header>
      <section className="search-field">
        <label htmlFor="site-search">Hva leter du etter?</label>
        <input id="site-search" type="search" placeholder="Søk etter for eksempel kurs eller kontakt ..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </section>
      {failedSources.length > 0 && <p className="search-error" role="alert">Kunne ikke laste {failedSources.join(", ")}. Søkeresultatene kan være ufullstendige. Last inn siden på nytt for å prøve igjen.</p>}
      <p className="search-count" role="status">
        {loading ? "Laster søkbart innhold …" : searchText ? `${results.length} treff på «${searchText}»` : "Skriv et søkeord for å se treff."}
      </p>
      {searchText && Object.entries(groups).map(([category, items]) => (
        <section className="search-group" key={category}>
          <h2>{category}</h2>
          <ul className="search-results">
            {items.map((item, index) => (
              <li key={`${item.path}-${item.title}-${index}`}>
                <h3><Highlight value={item.title} term={searchText} /></h3>
                {item.subcategory && <p className="search-subcategory">Kategori: <Highlight value={item.subcategory} term={searchText} /></p>}
                <ul className="search-matches">
                  {item.matches.map(([label, value], matchIndex) => (
                    <li key={`${label}-${matchIndex}`}><strong>{label}:</strong> <Highlight value={value} term={searchText} excerpt /></li>
                  ))}
                </ul>
                <Link to={item.path}>Gå til {category.toLocaleLowerCase("nb-NO")} <span aria-hidden="true">→</span></Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!loading && searchText && results.length === 0 && <p className="search-empty">Ingen treff. Prøv et annet søkeord.</p>}
    </main>
  );
}
