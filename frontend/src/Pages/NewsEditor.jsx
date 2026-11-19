// Håndterer oppretting, redigering og publisering av nyheter
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api.js";
import { NewsCard } from "./NewsCard.jsx";
import { getNewsImageSource } from "./newsUtils.js";

const emptyNews = {
  title: "",
  category: "Fra laget",
  summary: "",
  text: "",
  date: new Date().toLocaleDateString("sv-SE"),
  imageUrl: "",
  status: "published",
};

const maximumImageSize = 5 * 1024 * 1024;
const allowedImageTypes = ["image/png", "image/jpeg", "image/webp"];

export default function NewsEditor() {
  const navigate = useNavigate();
  const { newsId } = useParams();
  const isEditingNews = Boolean(newsId);
  const [newsDraft, setNewsDraft] = useState(emptyNews);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let isComponentMounted = true;

    async function loadNews() {
      // Utkast og arkivert innhold lastes bare etter at administratorøkten er kontrollert
      await apiRequest("/auth/me");
      if (!isComponentMounted) return;
      setIsAdminAuthenticated(true);
      if (!newsId) return;

      const existingNews = await apiRequest(`/news/${encodeURIComponent(newsId)}`);
      if (!isComponentMounted) return;
      setNewsDraft({
        title: existingNews.title || "",
        category: existingNews.category || "Fra laget",
        summary: existingNews.summary || existingNews.excerpt || "",
        text: existingNews.text || existingNews.body || "",
        date: existingNews.date || existingNews.publishedAt || "",
        imageUrl: existingNews.imageUrl || "",
        status: existingNews.status || "published",
      });
      setImagePreviewUrl(existingNews.imageUrl || "");
    }

    loadNews()
      .catch((loadError) => {
        if (isComponentMounted && loadError.status !== 401) {
          setFormError(loadError.message);
        }
      })
      .finally(() => {
        if (isComponentMounted) setIsLoading(false);
      });

    return () => {
      isComponentMounted = false;
    };
  }, [newsId]);

  useEffect(() => {
    return () => {
      // Frigjør lokale bilde-forhåndsvisninger når de byttes eller editoren lukkes
      if (imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function updateNewsDraft(event) {
    setNewsDraft((currentDraft) => ({
      ...currentDraft,
      [event.target.name]: event.target.value,
    }));
  }

  function updateSelectedImage(event) {
    const file = event.target.files?.[0] || null;
    setSelectedImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : newsDraft.imageUrl);
  }

  function showNewsPreview(event) {
    event.preventDefault();
    setFormError("");
    if (
      selectedImageFile &&
      (!allowedImageTypes.includes(selectedImageFile.type) ||
        selectedImageFile.size > maximumImageSize)
    ) {
      setFormError("Velg et PNG-, JPEG- eller WebP-bilde på maksimalt 5 MB.");
      return;
    }
    setIsPreviewVisible(true);
  }

  async function saveNews() {
    setIsSubmitting(true);
    setFormError("");
    try {
      const formData = new FormData();
      // Multipart-format lar nyhetstekst og eventuell bildefil sendes samlet
      formData.set("news", JSON.stringify(newsDraft));
      if (selectedImageFile) formData.set("image", selectedImageFile);
      await apiRequest(
        isEditingNews ? `/news/${encodeURIComponent(newsId)}` : "/news",
        {
          method: isEditingNews ? "PUT" : "POST",
          body: formData,
        },
      );
      navigate("/nyheter", { replace: true });
    } catch (saveError) {
      setFormError(saveError.message);
      setIsConfirmationOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const actionLabel =
    newsDraft.status === "published"
      ? isEditingNews
        ? "Lagre endringer"
        : "Publiser nyhet"
      : newsDraft.status === "draft"
        ? "Lagre utkast"
        : "Arkiver nyhet";
  const visibilityMessage =
    newsDraft.status === "published"
      ? "Nyheten blir synlig på nyhetssiden."
      : newsDraft.status === "draft"
        ? "Nyheten lagres som utkast og vises ikke for besøkende."
        : "Nyheten arkiveres og vises ikke lenger for besøkende.";

  if (isLoading) {
    return (
      <main className="news-page news-editor">
        <p>Kontrollerer administratorinnlogging …</p>
      </main>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <main className="news-page news-editor">
        <h1>Administratorinnlogging kreves</h1>
        <p>{formError || "Logg inn som administrator for å redigere nyheter."}</p>
        <Link to="/min-side">Gå til innlogging</Link>
      </main>
    );
  }

  if (isEditingNews && formError && !newsDraft.title) {
    return (
      <main className="news-page news-editor">
        <h1>Kunne ikke laste nyheten</h1>
        <p className="news-error" role="alert">{formError}</p>
        <Link to="/nyheter">← Tilbake til nyheter</Link>
      </main>
    );
  }

  const previewNews = {
    ...newsDraft,
    id: newsId ? Number(newsId) : 1,
    imageUrl: imagePreviewUrl,
  };

  return (
    <main className="news-page news-editor">
      <Link to="/nyheter" className="news-editor-back">← Tilbake til nyheter</Link>
      <h1>
        {isPreviewVisible
          ? isEditingNews
            ? "Forhåndsvis endringer"
            : "Forhåndsvis nyhet"
          : isEditingNews
            ? "Rediger nyhet"
            : "Legg til nyhet"}
      </h1>
      {formError && <p className="news-error" role="alert">{formError}</p>}

      {isPreviewVisible ? (
        <section className="news-preview-stage">
          <p>Forhåndsvisning av hvordan nyheten vises på nyhetssiden.</p>
          <NewsCard item={previewNews} featured />
          <div className="news-editor-actions">
            <button
              type="button"
              className="news-editor-secondary"
              onClick={() => setIsPreviewVisible(false)}
            >
              Tilbake til redigering
            </button>
            <button type="button" onClick={() => setIsConfirmationOpen(true)}>
              {actionLabel}
            </button>
          </div>
        </section>
      ) : (
        <form className="news-editor-form" onSubmit={showNewsPreview}>
          <section className="news-editor-section">
            <h2>Nyhetsinnhold</h2>
            <label>
              <span>Tittel *</span>
              <input
                name="title"
                value={newsDraft.title}
                onChange={updateNewsDraft}
                maxLength={160}
                required
              />
            </label>
            <div className="news-editor-grid">
              <label>
                <span>Kategori *</span>
                <input
                  name="category"
                  value={newsDraft.category}
                  onChange={updateNewsDraft}
                  maxLength={80}
                  list="news-categories"
                  required
                />
                <datalist id="news-categories">
                  <option value="Fra laget" />
                  <option value="Kurs og aktiviteter" />
                  <option value="Lokallag" />
                </datalist>
              </label>
              <label>
                <span>Publiseringsdato *</span>
                <input
                  type="date"
                  name="date"
                  value={newsDraft.date}
                  onChange={updateNewsDraft}
                  required
                />
              </label>
            </div>
            <label>
              <span>Ingress *</span>
              <textarea
                name="summary"
                value={newsDraft.summary}
                onChange={updateNewsDraft}
                maxLength={500}
                rows={3}
                required
              />
            </label>
            <label>
              <span>Nyhetstekst *</span>
              <textarea
                name="text"
                value={newsDraft.text}
                onChange={updateNewsDraft}
                maxLength={12000}
                rows={9}
                required
              />
            </label>
            <label>
              <span>Forsidebilde</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={updateSelectedImage}
              />
              <small>PNG, JPEG eller WebP. Maksimalt 5 MB.</small>
            </label>
            {imagePreviewUrl && (
              <img
                className="news-editor-image-preview"
                src={getNewsImageSource(previewNews)}
                alt="Forhåndsvisning av nyhetsbildet"
              />
            )}
            <label>
              <span>Status</span>
              <select
                name="status"
                value={newsDraft.status}
                onChange={updateNewsDraft}
              >
                <option value="published">Publisert</option>
                <option value="draft">Utkast</option>
                <option value="archived">Arkivert</option>
              </select>
            </label>
          </section>

          <div className="news-editor-actions">
            <button type="submit" className="news-editor-secondary" disabled={isSubmitting}>
              Forhåndsvis
            </button>
            <button type="submit" disabled={isSubmitting}>
              {actionLabel}
            </button>
          </div>
          <p className="news-required-note">* Obligatoriske felt: Må fylles ut</p>
        </form>
      )}

      {isConfirmationOpen && (
        <div className="news-dialog-backdrop">
          <section
            className="news-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-publish-title"
          >
            <h2 id="news-publish-title">
              Er du sikker på at du vil {actionLabel.toLowerCase()}?
            </h2>
            <p>
              {isEditingNews
                ? `Endringene på «${newsDraft.title}» lagres. `
                : `Nyheten «${newsDraft.title}». `}
              {visibilityMessage}
            </p>
            <div className="news-editor-actions">
              <button
                type="button"
                className="news-editor-secondary"
                onClick={() => setIsConfirmationOpen(false)}
                disabled={isSubmitting}
              >
                Nei
              </button>
              <button type="button" onClick={saveNews} disabled={isSubmitting}>
                {isSubmitting ? "Lagrer …" : `Ja, ${actionLabel.toLowerCase()}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
