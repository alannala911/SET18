// Viser nyhet og administratorhandlinger for redigering og arkivering
import { Link } from "react-router-dom";
import { formatNewsDate, getNewsImageSource } from "./newsUtils.js";

export function NewsCard({
  item,
  featured = false,
  showEditControls = false,
  onArchive,
}) {
  return (
    <article
      className={`news-card${featured ? " news-featured" : ""}`}
      data-status={item.status}
    >
      {showEditControls && (
        <div className="news-admin-controls">
          <Link
            to={`/nyheter/${encodeURIComponent(item.id)}/rediger`}
            aria-label={`Rediger ${item.title}`}
          >
            Rediger
          </Link>
          {item.status !== "published" && (
            <span>{item.status === "draft" ? "Utkast" : "Arkivert"}</span>
          )}
          {item.status !== "archived" && onArchive && (
            <button
              type="button"
              aria-label={`Arkiver ${item.title}`}
              onClick={() => onArchive(item)}
            >
              Arkiver
            </button>
          )}
        </div>
      )}
      <img src={getNewsImageSource(item)} alt="" loading="lazy" />
      <section className="news-card-content">
        <p className="news-meta">
          {item.category} · {formatNewsDate(item.date)}
        </p>
        <h2>{item.title}</h2>
        <p className="news-summary">{item.summary}</p>
        <details>
          <summary>Les hele nyheten</summary>
          <p className="news-text">{item.text}</p>
        </details>
      </section>
    </article>
  );
}
