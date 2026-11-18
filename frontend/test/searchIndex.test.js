import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchIndex, findSearchResults } from "../src/Pages/searchIndex.js";

test("søk finner delvise treff i publisert innhold og oppgir sted", () => {
  const index = buildSearchIndex({
    courses: [
      { title: "Lær fletting", category: "Håndverk", description: "Vi lager kurver", status: "published" },
      { title: "Hemmelig kurv", description: "kurver", status: "draft" },
    ],
    activities: [{ title: "Flettetreff", category: "Treff", description: "<p>Kurver i pil</p>", status: "published", ticketTypes: [{ name: "Deltaker", description: "Kurv inkludert" }] }],
    news: [{ title: "Nytt om kurver", category: "Lokalt", text: "Fletting", status: "published" }, { title: "Kurvutkast", status: "archived" }],
    htmlToText: (value) => value.replace(/<[^>]*>/g, ""),
  });
  const results = findSearchResults(index, "KURV");
  assert.deepEqual(results.map((result) => result.title), ["Lær fletting", "Flettetreff", "Nytt om kurver"]);
  assert.equal(results[0].category, "Kurs");
  assert.equal(results[0].subcategory, "Håndverk");
  assert.ok(results[1].matches.some(([label]) => label === "Billettbeskrivelse"));
  assert.ok(results[2].matches.some(([label]) => label === "Tittel"));
  assert.deepEqual(findSearchResults(index, "   "), []);
});

test("søk bruker bare aktive offentlige skjemaer og kontaktinnstillinger", () => {
  const index = buildSearchIndex({
    membership: {
      membershipTypes: { regular: false },
      customForms: [
        { id: "custom_active", name: "Åpent skjema", active: true, fields: [{ label: "Spesialfelt", options: ["Spesialvalg"] }] },
        { id: "custom_hidden", name: "Hemmelig skjema", active: false, fields: [] },
      ],
      fields: { minor: { "child.firstName": { visible: false, label: "Skjult felt" } } },
      sections: { minor: { "Forelders informasjon": { visible: false, label: "Hemmelig seksjon" } } },
    },
    contact: { introduction: "Ta kontakt", people: [{ name: "Testperson", role: "Leder", email: "person@example.test", phone: "12345678" }] },
  });
  assert.equal(findSearchResults(index, "spesial").length, 1);
  assert.equal(findSearchResults(index, "spesial")[0].path, "/medlemskap?type=custom_active");
  assert.equal(findSearchResults(index, "hemmelig").length, 0);
  assert.equal(findSearchResults(index, "skjult felt").length, 0);
  assert.equal(findSearchResults(index, "hemmelig seksjon").length, 0);
  assert.equal(findSearchResults(index, "testperson")[0].category, "Kontakt oss");
  assert.equal(findSearchResults(index, "vanlig medlemskap").length, 0);
});
