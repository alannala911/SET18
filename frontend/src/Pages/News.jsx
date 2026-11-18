// Håndterer nyhetsliste, publisering, arkivering og administratorhandlinger
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "./api.js";
import { NewsCard } from "./NewsCard.jsx";
import "./News.css";

const allCategories = "Alle nyheter";

export default function News() {
  const [newsList, setNewsList] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(allCategories);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isEditingNews, setIsEditingNews] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsLoadError, setNewsLoadError] = useState("");
  const [newsActionError, setNewsActionError] = useState("");
  const [newsPendingArchive, setNewsPendingArchive] = useState(null);
  const [isArchivingNews, setIsArchivingNews] = useState(false);

  const loadNews = useCallback(async () => {
    let isAdmin = false;
    let sessionErrorMessage = "";
    try {
      await apiRequest("/auth/me");
      isAdmin = true;
    } catch (sessionError) {
      if (sessionError.status !== 401) {
        sessionErrorMessage = sessionError.message;
      }
    }

    const loadedNews = await apiRequest(
      isAdmin ? "/news?scope=all" : "/news",
    );
    if (!Array.isArray(loadedNews)) {
      throw new Error("Nyhetslisten har et ugyldig format.");
    }
    return { loadedNews, isAdmin, sessionErrorMessage };
  }, []);

  useEffect(() => {
    let isComponentMounted = true;
    let requestSequence = 0;
    const refreshNews = () => {
      const sequence = ++requestSequence;
      loadNews()
        .then(({ loadedNews, isAdmin, sessionErrorMessage }) => {
          if (!isComponentMounted || sequence !== requestSequence) return;
          setNewsLoadError("");
          setNewsActionError(sessionErrorMessage);
          setIsAdminAuthenticated(isAdmin);
          setNewsList(loadedNews);
        })
        .catch((loadError) => {
          if (isComponentMounted && sequence === requestSequence) {
            setNewsLoadError(loadError.message);
          }
        })
        .finally(() => {
          if (isComponentMounted && sequence === requestSequence) {
            setIsLoadingNews(false);
          }
        });
    };

    refreshNews();
    window.addEventListener("set18-auth-change", refreshNews);
    return () => {
      isComponentMounted = false;
      window.removeEventListener("set18-auth-change", refreshNews);
    };
  }, [loadNews]);

  const sortedNews = [...newsList].sort((first, second) =>
    second.date.localeCompare(first.date),
  );
  const categoryOptions = [
    allCategories,
    ...new Set(sortedNews.map((item) => item.category)),
  ];
  const searchTerm = search.trim().toLocaleLowerCase("nb-NO");
  const filteredNews = sortedNews.filter((item) => {
    const searchableText =
      `${item.title} ${item.summary} ${item.text} ${item.category}`
        .toLocaleLowerCase("nb-NO");
    return (
      searchableText.includes(searchTerm) &&
      (category === allCategories || item.category === category)
    );
  });

  function beginNewsArchive(item) {
    setNewsActionError("");
    setNewsPendingArchive(item);
  }

  async function archiveNews() {
    if (!newsPendingArchive) return;
    setIsArchivingNews(true);
    setNewsActionError("");
    try {
      await apiRequest(`/news/${encodeURIComponent(newsPendingArchive.id)}`, {
        method: "DELETE",
      });
      setNewsList((currentNews) =>
        currentNews.map((item) =>
          item.id === newsPendingArchive.id
            ? { ...item, status: "archived" }
            : item,
        ),
      );
      setNewsPendingArchive(null);
    } catch (archiveError) {
      setNewsActionError(archiveError.message);
      setNewsPendingArchive(null);
    } finally {
      setIsArchivingNews(false);
    }
  }

  return (
    <main className="news-page">
      <header className="news-intro">
        <p className="news-label">Fra Østfold Husflidslag</p>
        <h1>Nyheter</h1>
        <p>Små og store nyheter fra husflidsmiljøet i Østfold.</p>
      </header>

      <section className="news-tools" aria-label="Søk og filtrering">
        <label className="news-search">
          <span>Søk i nyheter</span>
          <input
            type="search"
            placeholder="Skriv et søkeord ..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <nav className="news-filters" aria-label="Nyhetskategorier">
          {categoryOptions.map((name) => (
            <button
              key={name}
              type="button"
              className={category === name ? "selected" : ""}
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </section>

      <section className="news-results" aria-labelledby="news-results-heading">
        <header className="news-results-heading">
          <div>
            <p className="news-label">
              {isAdminAuthenticated ? "Administrasjon" : "Siste nytt"}
            </p>
            <h2 id="news-results-heading">
              {isAdminAuthenticated ? "Nyhetsarkiv" : "Aktuelt"}
            </h2>
          </div>
          <span className="news-count" aria-live="polite">
            Viser {filteredNews.length} av {newsList.length} nyheter
          </span>
        </header>

        {isAdminAuthenticated && (
          <div className="news-admin-actions">
            <button
              type="button"
              onClick={() => setIsEditingNews((currentlyEditing) => !currentlyEditing)}
            >
              {isEditingNews ? "Avslutt redigering" : "Rediger nyheter"}
            </button>
            <Link to="/nyheter/ny">Legg til nyhet</Link>
          </div>
        )}

        {newsActionError && (
          <p className="news-error" role="alert">{newsActionError}</p>
        )}
        {newsLoadError && (
          <p className="news-error" role="alert">{newsLoadError}</p>
        )}

        {isLoadingNews ? (
          <p className="news-empty">Laster nyheter …</p>
        ) : filteredNews.length > 0 ? (
          <>
            <NewsCard
              item={filteredNews[0]}
              featured
              showEditControls={isEditingNews && isAdminAuthenticated}
              onArchive={beginNewsArchive}
            />
            {filteredNews.length > 1 && (
              <section className="news-more">
                <h2>Flere nyheter</h2>
                <section className="news-grid" aria-label="Flere nyheter">
                  {filteredNews.slice(1).map((item) => (
                    <NewsCard
                      key={item.id}
                      item={item}
                      showEditControls={isEditingNews && isAdminAuthenticated}
                      onArchive={beginNewsArchive}
                    />
                  ))}
                </section>
              </section>
            )}
          </>
        ) : (
          <div className="news-empty">
            <h2>{newsList.length ? "Ingen nyheter funnet" : "Ingen nyheter ennå"}</h2>
            <p>
              {newsList.length
                ? "Ingen nyheter passer med søket ditt. Prøv et annet søkeord eller en annen kategori."
                : "Det er ingen publiserte nyheter å vise akkurat nå."}
            </p>
            {newsList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory(allCategories);
                }}
              >
                Vis alle nyheter
              </button>
            )}
          </div>
        )}
      </section>

      {newsPendingArchive && (
        <div className="news-dialog-backdrop">
          <section
            className="news-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-archive-title"
          >
            <h2 id="news-archive-title">Arkivere nyheten?</h2>
            <p>
              «{newsPendingArchive.title}» skjules for besøkende. Du kan publisere
              den igjen ved å endre status.
            </p>
            <div className="news-editor-actions">
              <button
                type="button"
                className="news-editor-secondary"
                onClick={() => setNewsPendingArchive(null)}
                disabled={isArchivingNews}
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={archiveNews}
                disabled={isArchivingNews}
              >
                {isArchivingNews ? "Arkiverer …" : "Arkiver nyhet"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
