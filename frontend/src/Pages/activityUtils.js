// Inneholder hjelpefunksjoner for aktivitetsdata, priser og visning
import { API_BASE_URL } from "./api.js";

export const knownActivityDecorations = {
  1: { emoji: "🧶", color: "pink", tagline: "Møt andre med samme interesse" },
  2: { emoji: "🪡", color: "yellow", tagline: "Lær, del og prøv noe nytt" },
  3: { emoji: "🎄", color: "green", tagline: "Skap gode minner sammen" },
};
export const fallbackActivityColors = ["pink", "yellow", "green"];
export const activityMemberTypeOptions = [
  ["regular", "Vanlig medlem"],
  ["minor", "Mindreårig medlem"],
  ["gift", "Gavemedlem"],
  ["craft", "Husflidshåndverker"],
];
export const discountMemberTypeOptions = activityMemberTypeOptions.filter(([memberType]) => memberType !== "gift");
export const emptyDiscountDraft = {
  enabled: false,
  type: "percent",
  value: "",
  memberTypes: discountMemberTypeOptions.map(([memberType]) => memberType),
  hasPeriod: false,
  startDate: "",
  endDate: "",
};
export const allowedActivityImageTypes = ["image/png", "image/jpeg", "image/webp"];
export const maximumActivityImageSizeBytes = 5 * 1024 * 1024;
export const activitiesPerPage = 15;
export const activityStatusOptions = [["published", "Publisert"], ["draft", "Utkast"], ["archived", "Arkivert"]];
export const activityPriceFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
});

export function getDiscountedPrice(activity, ticketType, memberType) {
  const discount = activity.discount;
  const today = new Date().toISOString().slice(0, 10);
  const appliesToMember = discount?.memberTypes.includes(memberType);
  const isWithinDateRange = (!discount?.startDate || today >= discount.startDate) &&
    (!discount?.endDate || today <= discount.endDate);
  if (!appliesToMember || !isWithinDateRange) return ticketType.price;
  const discountAmount = discount.type === "percent"
    ? ticketType.price * discount.value / 100
    : discount.value;
  return Math.max(0, Math.round((ticketType.price - discountAmount) * 100) / 100);
}

export function formatActivityDate(dateValue) {
  const activityDate = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(activityDate.getTime())
    ? dateValue
    : new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(activityDate);
}

export function getActivityPriceRange(ticketTypes = []) {
  const prices = ticketTypes.map((ticketType) => Number(ticketType.price)).filter(Number.isFinite);
  if (prices.length === 0) return "";
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  return `${activityPriceFormatter.format(lowestPrice)} - ${activityPriceFormatter.format(highestPrice)}`;
}

export function getMemberTypeLabel(memberType) {
  return activityMemberTypeOptions.find(([optionValue]) => optionValue === memberType)?.[1] || memberType;
}

export function getDiscountAmountText({ type, value }) {
  return type === "percent" ? `${value} %` : activityPriceFormatter.format(value);
}

export function getDiscountPeriodText({ startDate, endDate }) {
  if (startDate && endDate) return `${formatActivityDate(startDate)} – ${formatActivityDate(endDate)}`;
  if (startDate) return `fra ${formatActivityDate(startDate)}`;
  if (endDate) return `til ${formatActivityDate(endDate)}`;
  return "";
}

export function isDiscountExpired(discount) {
  return Boolean(discount.endDate) && discount.endDate < new Date().toLocaleDateString("sv-SE");
}

export function discountToDraft(discount) {
  return discount
    ? { ...emptyDiscountDraft, ...discount, enabled: true, value: String(discount.value), hasPeriod: Boolean(discount.startDate || discount.endDate) }
    : emptyDiscountDraft;
}

export function draftToDiscount({ enabled, type, value, memberTypes, hasPeriod, startDate, endDate }) {
  return enabled
    ? { type, value: Number(value), memberTypes, startDate: hasPeriod ? startDate : "", endDate: hasPeriod ? endDate : "" }
    : null;
}

export function formatActivityDuration(durationMinutes) {
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1) return "";
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return [hours ? `${hours} t` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ");
}

export function getActivityImageSource(imageUrl) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("/api/") && API_BASE_URL !== "/api") {
    return `${API_BASE_URL.replace(/\/+$/, "")}${imageUrl.slice(4)}`;
  }
  return imageUrl;
}

export function sanitizeActivityDescription(htmlContent) {
  const allowedTags = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3"]);
  return htmlContent.match(/<[^>]*>|[^<]+/g)?.map((htmlToken) => {
    if (!htmlToken.startsWith("<")) return htmlToken.replaceAll("&", "&amp;").replaceAll(">", "&gt;");
    const tagMatch = htmlToken.match(/^<\s*(\/?)\s*([a-z0-9]+)(?:\s+[^>]*)?\s*\/?>$/i);
    if (!tagMatch) return "";
    const [, closingMarker, rawTagName] = tagMatch;
    const tagName = rawTagName.toLowerCase();
    if (tagName === "font") {
      const fontSize = htmlToken.match(/\bsize\s*=\s*["']?([1-7])["']?/i)?.[1];
      return fontSize ? (closingMarker ? "</font>" : `<font size="${fontSize}">`) : "";
    }
    if (!allowedTags.has(tagName)) return "";
    return closingMarker ? `</${tagName}>` : `<${tagName}>`;
  }).join("") || "";
}

export function createEmptyTicketType() {
  return {
    name: "",
    description: "",
    price: "",
    quantity: "1",
    memberTypes: activityMemberTypeOptions.map(([memberType]) => memberType),
  };
}

export function normalizeTicketTypes(ticketTypes) {
  return ticketTypes.map((ticketType) => ({
    ...ticketType,
    price: Number(ticketType.price),
    quantity: Number(ticketType.quantity),
  }));
}
