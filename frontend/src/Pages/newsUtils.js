import { API_BASE_URL } from "./api.js";
import bilde1 from "../assets/bilder til nettsiden/Ikoner og Bilder/Bilde1.jpg";
import bilde2 from "../assets/bilder til nettsiden/Ikoner og Bilder/Bilde2.jpg";
import bilde3 from "../assets/bilder til nettsiden/Ikoner og Bilder/Bilde3.jpg";

const fallbackImages = [bilde1, bilde2, bilde3];

export function getNewsImageSource(item) {
  const imageUrl = item.imageUrl || "";
  if (imageUrl.startsWith("/api/") && API_BASE_URL !== "/api") {
    return `${API_BASE_URL.replace(/\/+$/, "")}${imageUrl.slice(4)}`;
  }
  if (/^\/images\/news-\d+\.jpg$/.test(imageUrl)) {
    return fallbackImages[(item.id - 1) % fallbackImages.length];
  }
  return imageUrl || fallbackImages[(item.id - 1) % fallbackImages.length];
}

export function formatNewsDate(dateValue) {
  const parsedDate = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(parsedDate.getTime())
    ? dateValue
    : new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(parsedDate);
}
