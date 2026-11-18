// Inneholder felles dato-, tids- og sorteringsfunksjoner for aktiviteter og kurs
function getLowestPrice(activity) {
  const prices = (activity.ticketTypes || []).map((ticketType) => Number(ticketType.price)).filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : null;
}

function getStartTime(activity) {
  const timeMatch = activity.time?.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : null;
}

export function getTodayDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

export function addCalendarDays(dateValue, numberOfDays) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + numberOfDays);
  return date.toISOString().slice(0, 10);
}

export function matchesDateFilter(date, today, period, startDate, endDate) {
  const matchesPeriod = {
    today: date === today,
    "next-seven-days": date >= today && date <= addCalendarDays(today, 6),
    "next-thirty-days": date >= today && date <= addCalendarDays(today, 29),
  }[period] ?? true;
  return matchesPeriod && (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

export function compareActivities(first, second, sortBy, sortDirection) {
  const firstValue = {
    date: first.date,
    time: getStartTime(first),
    duration: first.durationMinutes,
    location: first.location?.toLocaleLowerCase("nb-NO"),
    price: getLowestPrice(first),
  }[sortBy];
  const secondValue = {
    date: second.date,
    time: getStartTime(second),
    duration: second.durationMinutes,
    location: second.location?.toLocaleLowerCase("nb-NO"),
    price: getLowestPrice(second),
  }[sortBy];
  if (firstValue == null) return secondValue == null ? 0 : 1;
  if (secondValue == null) return -1;
  const comparison = typeof firstValue === "string"
    ? firstValue.localeCompare(secondValue, "nb-NO")
    : firstValue - secondValue;
  return sortDirection === "descending" ? -comparison : comparison;
}
