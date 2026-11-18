// Validerer og oppdaterer kurs og billetter i handlekurven
export function readCart(value) {
  if (value === null) return [];
  const items = JSON.parse(value);
  if (!Array.isArray(items) || items.some((item) =>
    !item || !["course", "activity"].includes(item.type) ||
    !Number.isSafeInteger(item.id) || item.id < 1 ||
    !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 ||
    (item.type === "activity" && item.ticketName !== undefined && (typeof item.ticketName !== "string" || !item.ticketName)))) {
    throw new Error("Handlekurven inneholder ugyldige data.");
  }
  const keys = items.map((item) => JSON.stringify([item.type, item.id, item.ticketName || ""]));
  if (new Set(keys).size !== items.length) throw new Error("Handlekurven inneholder dupliserte varer.");
  return items;
}

export function addCartItem(items, item) {
  const index = items.findIndex((entry) => entry.type === item.type && entry.id === item.id && entry.ticketName === item.ticketName);
  const quantity = (index < 0 ? 0 : items[index].quantity) + item.quantity;
  const activityTotal = item.type === "activity"
    ? items.filter((entry) => entry.type === "activity" && entry.id === item.id && entry.ticketName).reduce((sum, entry) => sum + entry.quantity, item.quantity)
    : 0;
  if (quantity > 10 || (item.type === "activity" && item.ticketName && (quantity > item.available || activityTotal > item.totalAvailable))) {
    throw new Error("Antallet overstiger grensen eller tilgjengelige billetter.");
  }
  const next = [...items];
  if (index >= 0) next[index] = { ...items[index], quantity };
  else next.push(item.type === "activity" && item.ticketName
    ? { type: item.type, id: item.id, ticketName: item.ticketName, quantity: item.quantity }
    : item);
  return next;
}
