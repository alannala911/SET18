import { municipalities } from "./municipalityData.js";
import { configurableFields, configurableSections, defaultCraftTypes, defaultGenderOptions, membershipTypes } from "./MembershipConfig.js";

const staticPages = [
  {
    category: "Forsiden", title: "Østfold Husflidslag", path: "/",
    fields: [["Innhold", "Velkommen til Østfold Husflidslag. Vi ivaretar og utvikler husflid og håndverk kulturelt, sosialt og økonomisk i Østfold."],
      ["Kurs", "Lær nye teknikker og utvikle ferdighetene dine."],
      ["Aktiviteter", "Bli med på arrangementer, møter og sosiale aktiviteter."],
      ["Nyheter", "Få med deg det siste fra Østfold Husflidslag."],
      ["Lokale lag", "Finn ditt nærmeste lokallag og se hva som skjer."]],
  },
  {
    category: "Kurs", title: "Kurs", path: "/kurs",
    fields: [["Introduksjon", "Tradisjon · kreativitet · fellesskap. Kurs og håndverk. Lær noe nytt, prøv deg på en ny teknikk og skap noe med hendene."],
      ["Kursoversikt", "Finn et kurs som passer for deg. Kommende kurs."],
      ["Kurskategorier", "Alle kurs Strikking Fletting Toving Søm Broderi"]],
  },
  {
    category: "Aktiviteter", title: "Aktiviteter for alle", path: "/aktiviteter",
    fields: [["Introduksjon", "Møt andre · skap noe sammen. Oppdag hyggelige møteplasser, håndarbeidstreff og kreative aktiviteter i Østfold."],
      ["Kommende aktiviteter", "Hva skjer framover?"],
      ["Alle skal kunne finne noe som passer", "Aktivitetssiden er laget for å gjøre det enkelt å se hva som skjer, hvor det skjer og når du kan delta."]],
  },
  { category: "Nyheter", title: "Nyheter", path: "/nyheter", fields: [["Introduksjon", "Fra Østfold Husflidslag. Små og store nyheter fra husflidsmiljøet i Østfold."], ["Nyhetsoversikt", "Siste nytt Aktuelt Flere nyheter"]] },
  {
    category: "Om oss", title: "Om Østfold Husflidslag", path: "/om-oss",
    fields: [
      ["Introduksjon", "Tradisjon · kreativitet · fellesskap. Vi skaper møteplasser for håndverk, læring og fellesskap i Østfold."],
      ["Dette ønsker vi å bidra til", "Dette ønsker vi å bidra til"],
      ["Håndverk som bringer oss sammen", "Husflid handler om å skape med hendene og dele kunnskap med andre. Vi ønsker å gjøre tradisjonelle teknikker og skaperglede tilgjengelig for både nye og erfarne håndverksinteresserte."],
      ["Ta vare på tradisjoner", "Vi deler kunnskap og holder håndverksteknikker levende."],
      ["Lære og skape", "Vi gir rom for å prøve nye teknikker og utvikle ferdigheter."],
      ["Bygge fellesskap", "Vi ønsker møteplasser der alle kan føle seg velkomne."],
      ["Finn din plass i husflidsmiljøet", "Utforsk kursene våre eller finn et lokallag nær deg."],
    ],
  },
  {
    category: "Kommuner og lokallag", title: "Kommuner og lokallag", path: "/kommuner",
    fields: [["Introduksjon", "Husflid nær deg. Finn et husflidsmiljø nær deg og bli med på lokale aktiviteter."],
      ["Finn ditt lokallag", "Prototype: Oppføringene er eksempler. Navn på lokallag og kontaktinformasjon må bekreftes."],
      ["Usikker på hvilket lag du skal velge?", "Ta kontakt for hjelp med å finne riktig lokallag."]],
  },
  ...municipalities.map((name) => ({
    category: "Kommuner og lokallag", title: `Lokallag i ${name}`, path: "/kommuner",
    fields: [["Kommune", name], ["Informasjon", `Håndverk og fellesskap i nærmiljøet. Her vil du finne informasjon om lokallag, møteplasser og aktiviteter i ${name}. Oppføringen er foreløpig et eksempel.`]],
  })),
  { category: "Kontakt oss", title: "Kontakt oss", path: "/kontakt", fields: [["Side", "Vi hører gjerne fra deg. Kontakt oss. Send oss en melding."], ["Kontaktpersoner", "Styret og kontaktpersoner"]] },
  { category: "Medlemskap", title: "Medlemskap og søknader", path: "/medlemskap", fields: [["Side", "Medlemskap og søknader"]] },
  { category: "Min side", title: "Logg inn", path: "/min-side", fields: [["Innlogging", "Logg inn. Glemt passord? Bli medlem."]] },
];

const text = (value) => typeof value === "string" ? value : "";
const fields = (item, keys) => keys.map(([key, label]) => [label, text(item[key])]);
const price = (value) => typeof value === "number" && Number.isFinite(value)
  ? `${new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(value)} kr`
  : "";
const date = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return "";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
};

function fieldSection(flow, key) {
  if (key.startsWith("localGroup.")) return "Velg lokallag";
  if (flow === "regular") {
    if (key === "birthDate") return "Alderskontroll";
    if (key.startsWith("person.")) return "Personlig informasjon";
    if (key.startsWith("address.")) return "Adresse";
    if (key.toLowerCase().includes("password")) return "Passord";
  }
  if (flow === "minor") {
    if (key === "child.birthDate") return "Barnets alder";
    if (key.startsWith("child.")) return "Barnets informasjon";
    if (key.startsWith("parent.")) return "Forelders informasjon";
    if (key.startsWith("address.")) return "Adresse";
  }
  if (flow === "gift") {
    if (key === "purchaser.birthDate") return "Kjøperens alderskontroll";
    if (key === "recipient.birthDate") return "Mottakerens alderskontroll";
    if (key.startsWith("purchaser.address.")) return "Kjøperens adresse";
    if (key.startsWith("recipient.address.")) return "Mottakerens adresse";
    if (key.startsWith("purchaser.")) return "Kjøperens personlige informasjon";
    if (key.startsWith("recipient.")) return "Mottakerens personlige informasjon";
    if (key.startsWith("guardian.")) return "Foresattens informasjon";
  }
  if (flow === "craft") {
    if (key.startsWith("business.address.")) return "Bedriftens adresse";
    if (key.startsWith("business.") && key !== "business.qualificationConfirmed") return "Bedriftsinformasjon";
    if (key.startsWith("applicant.address.")) return "Søkerens adresse";
    if (key === "applicant.birthDate") return "Søkerens fødselsdato";
    if (key.startsWith("applicant.")) return "Søkerens personinformasjon";
    if (key === "craftType") return "Håndverkstype";
    if (key === "files") return "Last opp dokumentasjon";
    if (key.startsWith("jury.")) return "Juryert opptak";
  }
  return "";
}

function publicFieldLabel(key, fallback) {
  const personPrefix = /^(person|child|parent|purchaser|recipient|guardian|applicant)\./;
  const personLabels = {
    firstName: "Fornavn",
    middleName: "Mellomnavn (valgfritt)",
    lastName: "Etternavn",
    gender: "Kjønn",
    email: "E-post",
    phone: "Telefonnummer",
  };
  const part = key.replace(personPrefix, "");
  if (key !== part && personLabels[part]) return personLabels[part];
  if (key.endsWith(".address.street") || key === "address.street") return "Gateadresse";
  if (key.endsWith(".address.postalCode") || key === "address.postalCode") return "Postnummer";
  if (key.endsWith(".address.city") || key === "address.city") return "Poststed";
  const labels = {
    "applicant.birthDate": "Fødselsdato",
    "business.phone": "Telefon",
    "business.email": "E-post",
    "business.website": "Hjemmeside (valgfritt)",
    "business.qualificationConfirmed": "Jeg bekrefter at minst én ansatt i bedriften har svennebrev, tilsvarende utdanning eller høyere håndverksutdanning.",
    "jury.exhibitions": "Deltagelse på nasjonale juryerte utstillinger",
    "jury.awards": "Mottatt designpris eller lignende på nasjonalt/regionalt nivå",
    craftType: "Velg håndverkstype",
    admissionMethod: "Vurdering av søknad",
    files: "Svennebrev/fagbrev (PDF eller bilde)",
    consent: "Jeg bekrefter at foresatt har gitt samtykke til medlemskapet.",
    criteriaAccepted: "Jeg har forstått medlemskriteriene for Norske Husflidshåndverkere i Norges Husflidslag.",
    "localGroup.region": "Region",
    "localGroup.chapter": "Lokallag",
  };
  return labels[key] || fallback;
}

export function buildSearchIndex({ courses = [], activities = [], news = [], contact, membership, htmlToText = text } = {}) {
  const entries = [...staticPages];
  for (const course of courses.filter((item) => item.status === "published")) {
    entries.push({
      category: "Kurs", title: course.title, path: "/kurs", subcategory: course.category,
      fields: [...fields(course, [["title", "Tittel"], ["category", "Kategori"], ["description", "Beskrivelse"], ["place", "Sted"], ["date", "Dato"], ["time", "Tid"]]), ["Dato", date(course.date)], ["Pris", price(course.price)]],
    });
  }
  for (const activity of activities.filter((item) => (item.status ?? "published") === "published")) {
    entries.push({
      category: "Aktiviteter", title: activity.title, path: "/aktiviteter", subcategory: activity.category,
      fields: [
        ...fields(activity, [["title", "Tittel"], ["category", "Kategori"], ["location", "Sted"], ["date", "Dato"], ["time", "Tid"]]),
        ["Dato", date(activity.date)],
        ["Beskrivelse", htmlToText(text(activity.description))],
        ...(activity.ticketTypes || []).flatMap((ticket) => [...fields(ticket, [["name", "Billett"], ["description", "Billettbeskrivelse"]]), ["Billettpris", price(ticket.price)]]),
      ],
    });
  }
  for (const item of news.filter((entry) => entry.status === "published")) {
    entries.push({
      category: "Nyheter", title: item.title, path: "/nyheter", subcategory: item.category,
      fields: [...fields(item, [["title", "Tittel"], ["category", "Kategori"], ["summary", "Sammendrag"], ["text", "Nyhetstekst"], ["date", "Dato"]]), ["Dato", date(item.date)]],
    });
  }
  if (contact) {
    entries.push({
      category: "Kontakt oss", title: "Kontaktinformasjon", path: "/kontakt",
      fields: fields(contact, [["introduction", "Introduksjon"], ["email", "E-post"], ["phone", "Telefon"], ["address", "Adresse"]]),
    });
    for (const person of contact.people || []) {
      entries.push({
        category: "Kontakt oss", title: person.name, subcategory: "Kontaktperson", path: "/kontakt",
        fields: fields(person, [["name", "Navn"], ["role", "Rolle"], ["email", "E-post"], ["phone", "Telefon"]]),
      });
    }
  }
  if (membership) {
    for (const [flow, label] of membershipTypes) {
      if (membership.membershipTypes?.[flow] === false) continue;
      const formFields = [["Skjema", label]];
      const admissionVisible = membership.fields?.craft?.admissionMethod?.visible !== false;
      const admissionChoices = membership.options?.craft?.admissionMethod || ["certificate", "jury"];
      const craftSectionAvailable = (section) => flow !== "craft" || (
        section !== "Last opp dokumentasjon" && section !== "Juryert opptak"
      ) || (admissionVisible && admissionChoices.includes(section === "Juryert opptak" ? "jury" : "certificate"));
      for (const section of configurableSections[flow]) {
        if ((flow === "minor" && section === "Passord") || !craftSectionAvailable(section)) continue;
        const setting = membership.sections?.[flow]?.[section] || {};
        if (setting.visible === false) continue;
        formFields.push(["Innholdsboks", setting.label || section], ["Hjelpetekst", text(setting.description)]);
      }
      for (const [key, defaultLabel] of configurableFields[flow]) {
        const setting = membership.fields?.[flow]?.[key] || {};
        const section = fieldSection(flow, key);
        if (flow === "craft" && key === "files") {
          if (admissionVisible && admissionChoices.includes("certificate") && membership.sections?.craft?.["Last opp dokumentasjon"]?.visible !== false) {
            formFields.push(["Felt", setting.label || "Svennebrev/fagbrev (PDF eller bilde)"]);
          }
          if (admissionVisible && admissionChoices.includes("jury") && membership.sections?.craft?.["Juryert opptak"]?.visible !== false) {
            formFields.push(["Felt", setting.label || "Produktbilder (PDF eller bilder)"]);
          }
          continue;
        }
        if (setting.visible === false || !craftSectionAvailable(section) || (section && membership.sections?.[flow]?.[section]?.visible === false)) continue;
        formFields.push(["Felt", setting.label || publicFieldLabel(key, defaultLabel)], ["Hjelpetekst", text(setting.placeholder)]);
        if (key.endsWith(".gender") || key === "craftType") {
          const options = membership.options?.[flow]?.[key] || (key === "craftType" ? defaultCraftTypes : defaultGenderOptions);
          for (const option of options) formFields.push(["Valg", text(option)]);
        }
      }
      for (const field of membership.additionalFields?.[flow] || []) {
        const setting = membership.fields?.[flow]?.[field.id] || {};
        if (field.type !== "section" && setting.visible === false) continue;
        formFields.push(["Felt", text(field.type === "section" ? field.label : setting.label || field.label)], ["Innhold", text(field.content)]);
        for (const option of field.options || []) formFields.push(["Valg", text(option)]);
      }
      if (flow === "craft" && admissionVisible && admissionChoices.includes("jury")) {
        formFields.push(["Produktinnsending", membership.craftShippingInstructions || "Informasjon om hvor produktene skal sendes er ikke satt ennå."]);
      }
      entries.push({ category: "Medlemskap", title: label, path: `/medlemskap?type=${encodeURIComponent(flow)}`, fields: formFields });
    }
    for (const form of (membership.customForms || []).filter((item) => item.active)) {
      entries.push({
        category: "Medlemskap", title: form.name, path: `/medlemskap?type=${encodeURIComponent(form.id)}`,
        fields: [["Skjema", text(form.name)], ["Beskrivelse", text(form.description)],
          ...(form.fields || []).flatMap((field) => [
            ["Felt", text(field.label)], ["Innhold", text(field.content)],
            ...(field.options || []).map((option) => ["Valg", text(option)]),
          ])],
      });
    }
    if (membership.regions?.length && membershipTypes.some(([flow]) =>
      membership.membershipTypes?.[flow] !== false && membership.sections?.[flow]?.["Velg lokallag"]?.visible !== false)) {
      entries.push({
        category: "Medlemskap", title: "Regioner og lokallag", path: "/medlemskap",
        fields: membership.regions.flatMap((region) => [["Region", text(region.name)], ...(region.chapters || []).map((chapter) => ["Lokallag", text(chapter)])]),
      });
    }
  }
  return entries;
}

export function findSearchResults(entries, query) {
  const term = query.trim().toLocaleLowerCase("nb-NO");
  if (!term) return [];
  return entries.flatMap((entry) => {
    const searchable = [["Tittel", text(entry.title)], ...entry.fields.flatMap(([label, value]) => [
      [label, value],
      ...(label.toLocaleLowerCase("nb-NO").includes(term) && label !== value ? [["Overskrift", label]] : []),
    ])];
    const matches = searchable.filter(([, value], index) =>
      value.toLocaleLowerCase("nb-NO").includes(term) &&
      searchable.findIndex(([otherLabel, otherValue]) => otherLabel === searchable[index][0] && otherValue === value) === index);
    return matches.length ? [{ ...entry, matches }] : [];
  });
}
