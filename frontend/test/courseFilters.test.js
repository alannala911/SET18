import test from "node:test";
import assert from "node:assert/strict";
import { courseDuration, filterCourses } from "../src/Pages/courseFilters.js";
import { matchesDateFilter } from "../src/Pages/dateSortFilters.js";

const courses = [
  { title: "Veving", description: "Lær veving", category: "Tekstil", place: "Moss", date: "2026-03-30", time: "12:00–15:00", price: 500 },
  { title: "Strikking", description: "Lær strikking", category: "Tekstil", place: "Halden", date: "2026-03-28", time: "09:00-10:00", price: 200 },
  { title: "Tre", description: "Lag en kurv", category: "Tre", place: "Moss", date: "2026-04-04", time: "Etter avtale", price: 300 },
];
const defaults = { search: "", category: "Alle kurs", period: "all", startDate: "", endDate: "", today: "2026-03-28", sortBy: "original", sortDirection: "ascending" };
const titles = (options) => filterCourses(courses, { ...defaults, ...options }).map((course) => course.title);

test("kursfiltrene kombinerer søk, kategori, tidsperiode og datointervall", () => {
  assert.deepEqual(titles({}), ["Veving", "Strikking", "Tre"]);
  assert.deepEqual(titles({ period: "today" }), ["Strikking"]);
  assert.deepEqual(titles({ period: "next-seven-days" }), ["Veving", "Strikking"]);
  assert.deepEqual(titles({ period: "next-thirty-days", category: "Tekstil", search: "vev", startDate: "2026-03-29", endDate: "2026-03-30" }), ["Veving"]);
  assert.deepEqual(titles({ startDate: "2026-04-01", endDate: "2026-03-29" }), []);
  assert.equal(matchesDateFilter("2026-04-03", defaults.today, "next-seven-days", "", ""), true);
  assert.equal(matchesDateFilter("2026-04-04", defaults.today, "next-seven-days", "", ""), false);
  assert.equal(matchesDateFilter("2026-04-26", defaults.today, "next-thirty-days", "", ""), true);
  assert.equal(matchesDateFilter("2026-04-27", defaults.today, "next-thirty-days", "", ""), false);
});

test("kurs sorteres etter dato, tid, varighet, sted og pris i begge retninger", () => {
  assert.deepEqual(titles({ sortBy: "date" }), ["Strikking", "Veving", "Tre"]);
  assert.deepEqual(titles({ sortBy: "date", sortDirection: "descending" }), ["Tre", "Veving", "Strikking"]);
  assert.deepEqual(titles({ sortBy: "time" }), ["Strikking", "Veving", "Tre"]);
  assert.deepEqual(titles({ sortBy: "duration", sortDirection: "descending" }), ["Veving", "Strikking", "Tre"]);
  assert.deepEqual(titles({ sortBy: "location" }), ["Strikking", "Veving", "Tre"]);
  assert.deepEqual(titles({ sortBy: "price" }), ["Strikking", "Tre", "Veving"]);
  assert.deepEqual(titles({ sortDirection: "descending" }), ["Tre", "Strikking", "Veving"]);
  assert.equal(courseDuration("17:00–21:00"), 240);
  assert.equal(courseDuration("23:00–01:00"), null);
  assert.equal(courseDuration("09:00 til 15:00"), null);
});
