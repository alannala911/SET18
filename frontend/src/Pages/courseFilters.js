import { compareActivities, matchesDateFilter } from "./dateSortFilters.js";

export function courseDuration(time) {
  const match = typeof time === "string" && time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)\s*[-–—]\s*([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return end > start ? end - start : null;
}

export function filterCourses(courses, { search, category, period, startDate, endDate, today, sortBy, sortDirection }) {
  const term = search.toLowerCase();
  const results = courses.filter((course) =>
    (course.title.toLowerCase().includes(term) ||
      course.description.toLowerCase().includes(term) ||
      course.place.toLowerCase().includes(term)) &&
    (category === "Alle kurs" || course.category === category) &&
    matchesDateFilter(course.date, today, period, startDate, endDate));
  if (sortBy === "original") return sortDirection === "descending" ? results.reverse() : results;
  const forComparison = (course) => ({
    date: course.date,
    time: course.time,
    durationMinutes: courseDuration(course.time),
    location: course.place,
    ticketTypes: [{ price: course.price }],
  });
  return results.sort((first, second) =>
    compareActivities(forComparison(first), forComparison(second), sortBy, sortDirection));
}
