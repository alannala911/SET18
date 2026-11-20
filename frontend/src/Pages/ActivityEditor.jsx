// Håndterer oppretting, redigering og validering av aktiviteter
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "./api.js";
import { ActivityCard } from "./ActivityCard.jsx";
import { getActivityValidationErrors } from "./activityValidation.js";
import { DiscountEditor, TicketTypesEditor } from "./ActivityEditorSections.jsx";
import { RichTextEditor } from "./ActivityEditorComponents.jsx";
import {
  activityStatusOptions,
  createEmptyTicketType,
  discountToDraft,
  draftToDiscount,
  emptyDiscountDraft,
  getActivityImageSource,
  normalizeTicketTypes,
  sanitizeActivityDescription,
} from "./activityUtils.js";

export function ActivityEditor() {
  const navigate = useNavigate();
  const { activityId: editingActivityId } = useParams();
  const isEditingActivity = Boolean(editingActivityId);
  const activityFormRef = useRef(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminSessionLoading, setIsAdminSessionLoading] = useState(true);
  const [adminSessionError, setAdminSessionError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isPublishConfirmationOpen, setIsPublishConfirmationOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [descriptionHtml, setDescriptionHtml] = useState("");
  const [ticketTypes, setTicketTypes] = useState([createEmptyTicketType()]);
  const [discountDraft, setDiscountDraft] = useState(emptyDiscountDraft);
  const [activityDraft, setActivityDraft] = useState({
    title: "",
    date: "",
    time: "",
    durationMinutes: "",
    location: "",
    category: "",
    ticketCapacity: "20",
    status: "published",
  });

  useEffect(() => {
    let isComponentMounted = true;

    async function loadActivity() {
      // Serveren beskytter også data for utkast og arkiv, derfor kontrolleres adminøkten først
      await apiRequest("/auth/me");
      if (!isComponentMounted) return;

      setIsAdminAuthenticated(true);
      if (!editingActivityId) return;

      const existingActivity = await apiRequest(`/activities/${encodeURIComponent(editingActivityId)}`);
      if (!isComponentMounted) return;

      setActivityDraft({
        title: existingActivity.title || "",
        date: existingActivity.date || "",
        time: existingActivity.time || "",
        durationMinutes: existingActivity.durationMinutes == null ? "" : String(existingActivity.durationMinutes),
        location: existingActivity.location || "",
        category: existingActivity.category || "",
        ticketCapacity: String(existingActivity.ticketCapacity || 20),
        status: existingActivity.status || "published",
      });
      setDescriptionHtml(existingActivity.description || "");
      setDiscountDraft(discountToDraft(existingActivity.discount));
      setTicketTypes((existingActivity.ticketTypes || []).map((ticketType) => ({
        name: ticketType.name || "",
        description: ticketType.description || "",
        price: String(ticketType.price ?? "0"),
        quantity: String(ticketType.quantity ?? "1"),
        memberTypes: Array.isArray(ticketType.memberTypes) ? ticketType.memberTypes : [],
      })));
      setImagePreviewUrl(getActivityImageSource(existingActivity.imageUrl || ""));
    }

    loadActivity()
      .catch((loadError) => {
        if (!isComponentMounted) return;
        if (loadError.status !== 401) setAdminSessionError(loadError.message);
      })
      .finally(() => {
        if (isComponentMounted) setIsAdminSessionLoading(false);
      });

    return () => { isComponentMounted = false; };
  }, [editingActivityId]);

  useEffect(() => {
    return () => {
      // Blob-adresser er midlertidige nettleserressurser og må frigjøres når de ikke brukes
      if (imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  function updateSelectedImage(event) {
    const selectedFile = event.target.files?.[0] || null;
    setSelectedImageFile(selectedFile);
    setImagePreviewUrl(selectedFile ? URL.createObjectURL(selectedFile) : "");
  }

  function updateActivityDraft(event) {
    setActivityDraft((currentDraft) => ({ ...currentDraft, [event.target.name]: event.target.value }));
  }

  function updateTicketType(ticketIndex, fieldName, fieldValue) {
    setTicketTypes((currentTicketTypes) => currentTicketTypes.map((ticketType, index) =>
      index === ticketIndex ? { ...ticketType, [fieldName]: fieldValue } : ticketType
    ));
  }

  function addTicketType() {
    setTicketTypes((currentTicketTypes) => [...currentTicketTypes, createEmptyTicketType()]);
  }

  function removeTicketType(ticketIndex) {
    setTicketTypes((currentTicketTypes) =>
      currentTicketTypes.filter((_, index) => index !== ticketIndex)
    );
  }

  function updateDiscount(fieldName, fieldValue) {
    setDiscountDraft((currentDraft) => ({ ...currentDraft, [fieldName]: fieldValue }));
  }

  function toggleTicketMemberType(ticketIndex, memberType) {
    const currentMemberTypes = ticketTypes[ticketIndex].memberTypes;
    updateTicketType(ticketIndex, "memberTypes", currentMemberTypes.includes(memberType)
      ? currentMemberTypes.filter((currentMemberType) => currentMemberType !== memberType)
      : [...currentMemberTypes, memberType]);
  }

  function validateBeforeAction(reportNativeValidity = false) {
    // Bruk samme regler ved forhåndsvisning, bekreftelse og lagring
    const validationErrors = getActivityValidationErrors({
      activityDraft,
      ticketTypes,
      discountDraft,
      selectedImageFile,
      isEditingActivity,
    });
    if (validationErrors.length === 0) {
      setFormError("");
      return true;
    }

    setFormError(validationErrors.join(" "));
    setIsPreviewVisible(false);
    setIsPublishConfirmationOpen(false);
    if (reportNativeValidity) activityFormRef.current?.reportValidity();
    return false;
  }

  function showActivityPreview(event) {
    event.preventDefault();
    if (!validateBeforeAction(true)) return;
    setIsPreviewVisible(true);
  }

  function requestFinalConfirmation() {
    if (!validateBeforeAction()) return;
    setIsPublishConfirmationOpen(true);
  }

  async function saveActivity() {
    if (!validateBeforeAction()) return;
    setIsSubmitting(true);
    try {
      const activityFormData = new FormData();
      // Send tekst og bilde i én forespørsel; tall og redigerbare delobjekter normaliseres først
      activityFormData.append("activity", JSON.stringify({
        ...activityDraft,
        description: descriptionHtml,
        durationMinutes: activityDraft.durationMinutes ? Number(activityDraft.durationMinutes) : null,
        ticketCapacity: Number(activityDraft.ticketCapacity),
        discount: draftToDiscount(discountDraft),
        ticketTypes: normalizeTicketTypes(ticketTypes),
      }));
      if (selectedImageFile) activityFormData.append("image", selectedImageFile);
      await apiRequest(
        isEditingActivity ? `/activities/${encodeURIComponent(editingActivityId)}` : "/activities",
        { method: isEditingActivity ? "PUT" : "POST", body: activityFormData }
      );
      navigate("/aktiviteter", { replace: true });
    } catch (saveError) {
      setFormError(saveError.message);
      setIsPublishConfirmationOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewActivityData = {
    ...activityDraft,
    durationMinutes: activityDraft.durationMinutes ? Number(activityDraft.durationMinutes) : null,
    description: sanitizeActivityDescription(descriptionHtml),
    imageUrl: imagePreviewUrl,
    discount: draftToDiscount(discountDraft),
    ticketTypes: normalizeTicketTypes(ticketTypes),
  };

  if (isAdminSessionLoading) {
    return (
      <main className="activities-page activities-editor-page">
        <p className="activities-empty">Kontrollerer administratorinnlogging …</p>
      </main>
    );
  }
  if (!isAdminAuthenticated) {
    return (
      <main className="activities-page activities-editor-page">
        <h1>Administratorinnlogging kreves</h1>
        <p>{adminSessionError || "Logg inn som administrator for å legge til aktiviteter."}</p>
        <Link className="activities-edit-button" to="/min-side">Gå til innlogging</Link>
      </main>
    );
  }
  if (isEditingActivity && adminSessionError) {
    return (
      <main className="activities-page activities-editor-page">
        <h1>Kunne ikke laste aktiviteten</h1>
        <p className="activity-error" role="alert">{adminSessionError}</p>
        <Link className="activity-back-link" to="/aktiviteter">← Tilbake til aktiviteter</Link>
      </main>
    );
  }

  return (
    <main className="activities-page activities-editor-page">
      <Link to="/aktiviteter" className="activity-back-link">← Tilbake til aktiviteter</Link>
      <h1>
        {isPreviewVisible
          ? (isEditingActivity ? "Forhåndsvis endringer" : "Forhåndsvis aktivitet")
          : (isEditingActivity ? "Rediger aktivitet" : "Legg til aktivitet")}
      </h1>
      {formError && <p className="activity-error" role="alert">{formError}</p>}
      {isPreviewVisible ? (
        <section className="activity-preview-stage">
          <p>Dette er en forhåndsvisning av hvordan aktiviteten vises på aktivitetslisten.</p>
          <section className="activity-list" aria-label="Forhåndsvisning av aktivitet">
            <ActivityCard activityData={previewActivityData} />
          </section>
          <div className="activity-preview-actions">
            <button
              type="button"
              className="activity-dialog-no"
              onClick={() => setIsPreviewVisible(false)}
            >
              Tilbake til redigering
            </button>
            <button
              type="button"
              className="activity-dialog-yes"
              onClick={requestFinalConfirmation}
            >
              {isEditingActivity ? "Lagre endringer" : "Publiser aktivitet"}
            </button>
          </div>
        </section>
      ) : (
      <form className="activity-editor-form" ref={activityFormRef} onSubmit={showActivityPreview} noValidate>
        <section className="activity-editor-section">
          <h2>Aktivitetsinformasjon</h2>
          <label className="activity-editor-field">
            <span>Tittel *</span>
            <input
              name="title"
              value={activityDraft.title}
              onChange={updateActivityDraft}
              maxLength={160}
              required
            />
          </label>
          <div className="activity-editor-grid">
            <label className="activity-editor-field">
              <span>Dato *</span>
              <input
                name="date"
                type="date"
                value={activityDraft.date}
                onChange={updateActivityDraft}
                required
              />
            </label>
            <label className="activity-editor-field">
              <span>Tid</span>
              <input
                name="time"
                value={activityDraft.time}
                onChange={updateActivityDraft}
                maxLength={80}
                placeholder="12:00–14:00"
                required
              />
            </label>
            <label className="activity-editor-field">
              <span>Varighet (minutter)</span>
              <input
                name="durationMinutes"
                type="number"
                min="1"
                max="1440"
                step="1"
                value={activityDraft.durationMinutes}
                onChange={updateActivityDraft}
                placeholder="Valgfritt"
              />
            </label>
            <label className="activity-editor-field">
              <span>Sted *</span>
              <input
                name="location"
                value={activityDraft.location}
                onChange={updateActivityDraft}
                maxLength={200}
                required
              />
            </label>
            <label className="activity-editor-field">
              <span>Kategori</span>
              <input
                name="category"
                value={activityDraft.category}
                onChange={updateActivityDraft}
                maxLength={100}
              />
            </label>
            <label className="activity-editor-field">
              <span>Status</span>
              <select name="status" value={activityDraft.status} onChange={updateActivityDraft}>
                {activityStatusOptions.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="activity-editor-section">
          <h2>Beskrivelse</h2>
          <RichTextEditor htmlContent={descriptionHtml} onHtmlContentChange={setDescriptionHtml} />
        </section>

        <section className="activity-editor-section">
          <h2>Bilde</h2>
          <label className="activity-editor-field">
            <span>Last opp bilde (valgfritt, maks 5 MB)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={updateSelectedImage}
            />
          </label>
          {imagePreviewUrl && (
            <img
              className="activity-image-preview"
              src={imagePreviewUrl}
              alt="Forhåndsvisning av aktivitetsbildet"
            />
          )}
        </section>

        <TicketTypesEditor
          activityDraft={activityDraft}
          ticketTypes={ticketTypes}
          onActivityDraftChange={updateActivityDraft}
          onAddTicketType={addTicketType}
          onRemoveTicketType={removeTicketType}
          onUpdateTicketType={updateTicketType}
          onToggleTicketMemberType={toggleTicketMemberType}
        />
        <DiscountEditor discountDraft={discountDraft} onUpdateDiscount={updateDiscount} />

        <div className="activity-preview-actions">
          <button type="submit" className="activity-dialog-no" disabled={isSubmitting}>
            Forhåndsvis
          </button>
          <button type="submit" className="activity-dialog-yes" disabled={isSubmitting}>
            {isEditingActivity ? "Lagre endringer" : "Publiser"}
          </button>
        </div>
        <p className="activity-required-note">* Obligatoriske felt: Må fylles ut</p>
      </form>
      )}

      {isPublishConfirmationOpen && (
        <div className="activity-dialog-backdrop">
          <section className="activity-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title">
            <h2 id="publish-dialog-title">
              {isEditingActivity
                ? "Er du sikker på at du vil lagre endringene?"
                : "Er du sikker på at du vil publisere denne aktiviteten?"}
            </h2>
            <p>
              {isEditingActivity
                ? `Endringene på «${activityDraft.title}» blir synlige under kommende aktiviteter.`
                : `Aktiviteten «${activityDraft.title}» blir synlig under kommende aktiviteter.`}
            </p>
            <div className="activity-dialog-actions">
              <button
                type="button"
                className="activity-dialog-no"
                onClick={() => setIsPublishConfirmationOpen(false)}
                disabled={isSubmitting}
              >
                Nei
              </button>
              <button
                type="button"
                className="activity-dialog-yes"
                onClick={saveActivity}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? (isEditingActivity ? "Lagrer …" : "Publiserer …")
                  : (isEditingActivity ? "Ja, lagre endringer" : "Ja, publiser")}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
