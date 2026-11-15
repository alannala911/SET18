import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api.js";
import { CourseCard } from "./CourseCard.jsx";

const emptyCourse = {
  title: "",
  category: "",
  description: "",
  date: "",
  time: "",
  place: "",
  price: "",
  symbol: "🧶",
  color: "wool",
  status: "published",
};

const courseColors = [
  ["basket", "Kurv"],
  ["wool", "Ull"],
  ["sewing", "Søm"],
  ["embroidery", "Broderi"],
  ["knitting", "Strikking"],
  ["christmas", "Jul"],
];

function getCoursePriceInputValue(price) {
  if (typeof price === "number") return String(price);
  if (typeof price !== "string") return "";
  return price.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kr)?$/i)?.[1]?.replace(",", ".") || "";
}

export default function CourseEditor() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isEditingCourse = Boolean(courseId);
  const [courseDraft, setCourseDraft] = useState(emptyCourse);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let isComponentMounted = true;

    async function loadCourse() {
      await apiRequest("/auth/me");
      if (!isComponentMounted) return;
      setIsAdminAuthenticated(true);
      if (!courseId) return;

      const existingCourse = await apiRequest(`/courses/${encodeURIComponent(courseId)}`);
      if (!isComponentMounted) return;
      setCourseDraft({
        title: existingCourse.title || "",
        category: existingCourse.category || "",
        description: existingCourse.description || "",
        date: existingCourse.date || "",
        time: existingCourse.time || "",
        place: existingCourse.place || "",
        price: getCoursePriceInputValue(existingCourse.price),
        symbol: existingCourse.symbol || "✦",
        color: existingCourse.color || "basket",
        status: existingCourse.status || "published",
      });
    }

    loadCourse()
      .catch((loadError) => {
        if (isComponentMounted && loadError.status !== 401) setFormError(loadError.message);
      })
      .finally(() => {
        if (isComponentMounted) setIsLoading(false);
      });

    return () => { isComponentMounted = false; };
  }, [courseId]);

  function updateCourseDraft(event) {
    setCourseDraft((currentDraft) => ({
      ...currentDraft,
      [event.target.name]: event.target.value,
    }));
  }

  function showCoursePreview(event) {
    event.preventDefault();
    setFormError("");
    setIsPreviewVisible(true);
  }

  async function saveCourse() {
    setIsSubmitting(true);
    setFormError("");
    try {
      await apiRequest(
        isEditingCourse ? `/courses/${encodeURIComponent(courseId)}` : "/courses",
        {
          method: isEditingCourse ? "PUT" : "POST",
          body: { ...courseDraft, price: Number(courseDraft.price) },
        }
      );
      navigate("/kurs", { replace: true });
    } catch (saveError) {
      setFormError(saveError.message);
      setIsConfirmationOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const courseActionLabel = courseDraft.status === "published"
    ? (isEditingCourse ? "Lagre endringer" : "Publiser kurs")
    : (courseDraft.status === "draft" ? "Lagre utkast" : "Arkiver kurs");
  const courseVisibilityMessage = courseDraft.status === "published"
    ? "Kurset blir synlig på kurssiden."
    : (courseDraft.status === "draft"
      ? "Kurset lagres som utkast og vises ikke på kurssiden."
      : "Kurset arkiveres og vises ikke lenger på kurssiden.");

  if (isLoading) {
    return (
      <main className="courses-page course-editor">
        <p className="no-courses">Kontrollerer administratorinnlogging …</p>
      </main>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <main className="courses-page course-editor">
        <h1>Administratorinnlogging kreves</h1>
        <p>{formError || "Logg inn som administrator for å redigere kurs."}</p>
        <Link to="/min-side">Gå til innlogging</Link>
      </main>
    );
  }

  if (isEditingCourse && formError && !courseDraft.title) {
    return (
      <main className="courses-page course-editor">
        <h1>Kunne ikke laste kurset</h1>
        <p className="course-error" role="alert">{formError}</p>
        <Link to="/kurs">← Tilbake til kurs</Link>
      </main>
    );
  }

  return (
    <main className="courses-page course-editor">
      <Link to="/kurs" className="course-editor-back">← Tilbake til kurs</Link>
      <h1>
        {isPreviewVisible
          ? (isEditingCourse ? "Forhåndsvis endringer" : "Forhåndsvis kurs")
          : (isEditingCourse ? "Rediger kurs" : "Legg til kurs")}
      </h1>
      {formError && <p className="course-error" role="alert">{formError}</p>}

      {isPreviewVisible ? (
        <section className="course-preview-stage">
          <p>Dette er en forhåndsvisning av hvordan kurset vises på kurssiden.</p>
          <section className="course-grid" aria-label="Forhåndsvisning av kurs">
            <CourseCard course={courseDraft} />
          </section>
          <div className="course-editor-actions">
            <button type="button" className="course-editor-secondary" onClick={() => setIsPreviewVisible(false)}>
              Tilbake til redigering
            </button>
            <button type="button" onClick={() => setIsConfirmationOpen(true)}>
              {courseActionLabel}
            </button>
          </div>
        </section>
      ) : (
        <form className="course-editor-form" onSubmit={showCoursePreview}>
          <section className="course-editor-section">
            <h2>Kursinformasjon</h2>
            <label>
              <span>Tittel *</span>
              <input name="title" value={courseDraft.title} onChange={updateCourseDraft} maxLength={160} required />
            </label>
            <label>
              <span>Kategori *</span>
              <input name="category" value={courseDraft.category} onChange={updateCourseDraft} maxLength={100} required />
            </label>
            <label>
              <span>Beskrivelse *</span>
              <textarea name="description" value={courseDraft.description} onChange={updateCourseDraft} maxLength={5000} rows={5} required />
            </label>
            <div className="course-editor-grid">
              <label>
                <span>Dato *</span>
                <input type="date" name="date" value={courseDraft.date} onChange={updateCourseDraft} required />
              </label>
              <label>
                <span>Tid *</span>
                <input name="time" value={courseDraft.time} onChange={updateCourseDraft} maxLength={80} placeholder="17:00–21:00" required />
              </label>
              <label>
                <span>Sted *</span>
                <input name="place" value={courseDraft.place} onChange={updateCourseDraft} maxLength={200} required />
              </label>
              <label>
                <span>Pris *</span>
                <input
                  type="number"
                  name="price"
                  value={courseDraft.price}
                  onChange={updateCourseDraft}
                  min="0.01"
                  step="0.01"
                  placeholder="650"
                  required
                />
              </label>
              <label>
                <span>Symbol *</span>
                <input name="symbol" value={courseDraft.symbol} onChange={updateCourseDraft} maxLength={20} required />
              </label>
              <label>
                <span>Farge *</span>
                <select name="color" value={courseDraft.color} onChange={updateCourseDraft}>
                  {courseColors.map(([color, label]) => <option key={color} value={color}>{label}</option>)}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select name="status" value={courseDraft.status} onChange={updateCourseDraft}>
                  <option value="published">Publisert</option>
                  <option value="draft">Utkast</option>
                  <option value="archived">Arkivert</option>
                </select>
              </label>
            </div>
          </section>

          <div className="course-editor-actions">
            <button type="submit" className="course-editor-secondary" disabled={isSubmitting}>
              Forhåndsvis
            </button>
            <button type="submit" disabled={isSubmitting}>
              {courseActionLabel}
            </button>
          </div>
          <p className="course-required-note">* Obligatoriske felt: Må fylles ut</p>
        </form>
      )}

      {isConfirmationOpen && (
        <div className="course-dialog-backdrop">
          <section
            className="course-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-publish-title"
          >
            <h2 id="course-publish-title">
              Er du sikker på at du vil {courseActionLabel.toLowerCase()}?
            </h2>
            <p>
              {isEditingCourse ? `Endringene på «${courseDraft.title}» lagres. ` : `Kurset «${courseDraft.title}». `}
              {courseVisibilityMessage}
            </p>
            <div className="course-dialog-actions">
              <button type="button" onClick={() => setIsConfirmationOpen(false)} disabled={isSubmitting}>
                Nei
              </button>
              <button type="button" onClick={saveCourse} disabled={isSubmitting}>
                {isSubmitting
                  ? (courseDraft.status === "published" && !isEditingCourse ? "Publiserer …" : "Lagrer …")
                  : `Ja, ${courseActionLabel.toLowerCase()}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
