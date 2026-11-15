const osloDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function archiveDate(now = new Date()) {
  const parts = Object.fromEntries(osloDate.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shouldArchive(item, today = archiveDate()) {
  return (item.status ?? "published") === "published" &&
    typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    item.date < today;
}

export function archivePastContent(state, now = new Date()) {
  const today = archiveDate(now);
  let count = 0;
  for (const item of [...state.courses, ...state.activities]) {
    if (!shouldArchive(item, today)) continue;
    item.status = "archived";
    item.updatedAt = now.toISOString();
    count += 1;
  }
  return count;
}
