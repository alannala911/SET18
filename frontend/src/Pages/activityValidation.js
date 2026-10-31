import { allowedActivityImageTypes, maximumActivityImageSizeBytes } from "./activityUtils.js";

export function getActivityValidationErrors({
  activityDraft,
  ticketTypes,
  discountDraft,
  selectedImageFile,
  isEditingActivity,
}) {
  const validationErrors = [];
  if (!activityDraft.title.trim()) validationErrors.push("Tittel må fylles inn.");
  if (!activityDraft.date || Number.isNaN(Date.parse(`${activityDraft.date}T00:00:00`))) {
    validationErrors.push("Dato må fylles inn.");
  }
  if (!activityDraft.time.trim()) validationErrors.push("Tid må fylles inn.");
  if (activityDraft.durationMinutes && (
    !Number.isSafeInteger(Number(activityDraft.durationMinutes)) ||
    Number(activityDraft.durationMinutes) < 1 ||
    Number(activityDraft.durationMinutes) > 1440
  )) {
    validationErrors.push("Varighet må være et helt antall minutter mellom 1 og 1440.");
  }
  if (!activityDraft.location.trim()) validationErrors.push("Sted må fylles inn.");
  const ticketCapacity = Number(activityDraft.ticketCapacity);
  if (!Number.isSafeInteger(ticketCapacity) || ticketCapacity < 1 || ticketCapacity > 100000) {
    validationErrors.push("Antall tilgjengelige billetter må være et helt tall mellom 1 og 100000.");
  }
  if (ticketTypes.length < 1 && !isEditingActivity) validationErrors.push("Legg til minst én billettype.");
  if (discountDraft.enabled) {
    const discountValue = Number(discountDraft.value);
    if (!discountDraft.value || !Number.isFinite(discountValue) || discountValue <= 0 || (discountDraft.type === "percent" && discountValue > 100)) {
      validationErrors.push(discountDraft.type === "percent"
        ? "Rabatt: prosenten må være større enn 0 og høyst 100."
        : "Rabatt: beløpet i kroner må være større enn 0.");
    }
    if (discountDraft.memberTypes.length === 0) validationErrors.push("Rabatt: velg minst én medlemstype.");
    if (discountDraft.hasPeriod && !discountDraft.startDate && !discountDraft.endDate) {
      validationErrors.push("Rabatt: oppgi start- og/eller sluttdato for perioden.");
    }
    if (discountDraft.hasPeriod && discountDraft.startDate && discountDraft.endDate && discountDraft.startDate > discountDraft.endDate) {
      validationErrors.push("Rabatt: startdatoen kan ikke være etter sluttdatoen.");
    }
  }
  ticketTypes.forEach((ticketType, ticketIndex) => {
    const ticketNumber = ticketIndex + 1;
    if (!ticketType.name.trim()) validationErrors.push(`Billettype ${ticketNumber}: navn må fylles inn.`);
    if (!ticketType.price.trim() || !Number.isFinite(Number(ticketType.price)) || Number(ticketType.price) < 0) {
      validationErrors.push(`Billettype ${ticketNumber}: prisen må fylles inn og være null eller høyere.`);
    }
    if (!Number.isSafeInteger(Number(ticketType.quantity)) || Number(ticketType.quantity) < 1) {
      validationErrors.push(`Billettype ${ticketNumber}: antall må være et positivt helt tall.`);
    }
    if (ticketType.memberTypes.length === 0) {
      validationErrors.push(`Billettype ${ticketNumber}: velg minst én medlemstype.`);
    }
  });
  const totalTicketQuantity = ticketTypes.reduce((total, ticketType) => total + Number(ticketType.quantity || 0), 0);
  if (totalTicketQuantity > ticketCapacity) {
    validationErrors.push("Summen av billettypene kan ikke overstige tilgjengelig kapasitet.");
  }
  if (selectedImageFile && (
    !allowedActivityImageTypes.includes(selectedImageFile.type) ||
    selectedImageFile.size > maximumActivityImageSizeBytes
  )) {
    validationErrors.push("Bildet må være PNG, JPEG eller WebP og maks 5 MB.");
  }
  return validationErrors;
}

