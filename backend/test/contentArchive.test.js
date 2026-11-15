import { test } from "node:test";
import assert from "node:assert/strict";
import { archiveDate, archivePastContent } from "../lib/contentArchive.js";

test("arkivering følger norsk dato og bevarer dagens oppføringer, utkast og bestillinger", () => {
  const beforeMidnight = new Date("2026-03-28T22:59:59Z");
  const afterMidnight = new Date("2026-03-28T23:00:00Z");
  assert.equal(archiveDate(beforeMidnight), "2026-03-28");
  assert.equal(archiveDate(afterMidnight), "2026-03-29");
  const state = {
    courses: [
      { id: 1, date: "2026-03-28", status: "published" },
      { id: 2, date: "2026-03-28", status: "draft" },
    ],
    activities: [
      { id: 3, date: "2026-03-28" },
      { id: 4, date: "2026-03-29", status: "published" },
    ],
    orders: [{ activityId: 3, status: "confirmed" }],
  };
  assert.equal(archivePastContent(state, beforeMidnight), 0);
  assert.equal(archivePastContent(state, afterMidnight), 2);
  assert.equal(state.courses[0].status, "archived");
  assert.equal(state.courses[1].status, "draft");
  assert.equal(state.activities[0].status, "archived");
  assert.equal(state.activities[1].status, "published");
  assert.equal(state.orders[0].status, "confirmed");
  assert.equal(archivePastContent(state, afterMidnight), 0);
});
