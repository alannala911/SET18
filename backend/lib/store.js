import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = path.resolve(process.env.DATA_DIR || "./data");
export const uploadDirectory = path.join(dataDirectory, "uploads");
const storePath = path.join(dataDirectory, "application-store.json");

const fieldDefinitions = {
  regular: [
    ["birthDate", "Fødselsdato", true],
    ["person.firstName", "Fornavn", true],
    ["person.middleName", "Mellomnavn", false],
    ["person.lastName", "Etternavn", true],
    ["person.gender", "Kjønn", true],
    ["person.email", "E-post", true],
    ["person.phone", "Telefonnummer", true],
    ["password", "Passord", true],
    ["confirmPassword", "Bekreft passord", true],
    ["address.street", "Gateadresse", true],
    ["address.postalCode", "Postnummer", true],
    ["address.city", "Poststed", true],
    ["localGroup.region", "Region", true],
    ["localGroup.chapter", "Lokallag", true]
  ],
  minor: [
    ["child.firstName", "Barnets fornavn", true],
    ["child.middleName", "Barnets mellomnavn", false],
    ["child.lastName", "Barnets etternavn", true],
    ["child.gender", "Barnets kjønn", true],
    ["child.email", "Barnets e-post", true],
    ["child.phone", "Barnets telefonnummer", true],
    ["child.birthDate", "Barnets fødselsdato", true],
    ["parent.firstName", "Forelders fornavn", true],
    ["parent.middleName", "Forelders mellomnavn", false],
    ["parent.lastName", "Forelders etternavn", true],
    ["parent.gender", "Forelders kjønn", true],
    ["parent.email", "Forelders e-post", true],
    ["parent.phone", "Forelders telefonnummer", true],
    ["password", "Passord", true],
    ["confirmPassword", "Bekreft passord", true],
    ["address.street", "Gateadresse", true],
    ["address.postalCode", "Postnummer", true],
    ["address.city", "Poststed", true],
    ["localGroup.region", "Region", true],
    ["localGroup.chapter", "Lokallag", true],
    ["consent", "Samtykke fra foresatt", true]
  ],
  gift: [
    ["purchaser.birthDate", "Kjøperens fødselsdato", true],
    ["purchaser.firstName", "Kjøperens fornavn", true],
    ["purchaser.middleName", "Kjøperens mellomnavn", false],
    ["purchaser.lastName", "Kjøperens etternavn", true],
    ["purchaser.gender", "Kjøperens kjønn", true],
    ["purchaser.email", "Kjøperens e-post", true],
    ["purchaser.phone", "Kjøperens telefonnummer", true],
    ["purchaser.address.street", "Kjøperens gateadresse", true],
    ["purchaser.address.postalCode", "Kjøperens postnummer", true],
    ["purchaser.address.city", "Kjøperens poststed", true],
    ["recipient.birthDate", "Mottakerens fødselsdato", true],
    ["recipient.firstName", "Mottakerens fornavn", true],
    ["recipient.middleName", "Mottakerens mellomnavn", false],
    ["recipient.lastName", "Mottakerens etternavn", true],
    ["recipient.gender", "Mottakerens kjønn", true],
    ["recipient.email", "Mottakerens e-post", true],
    ["recipient.phone", "Mottakerens telefonnummer", true],
    ["recipient.address.street", "Mottakerens gateadresse", true],
    ["recipient.address.postalCode", "Mottakerens postnummer", true],
    ["recipient.address.city", "Mottakerens poststed", true],
    ["guardian.firstName", "Foresattens fornavn (mindreårig mottaker)", false],
    ["guardian.middleName", "Foresattens mellomnavn (mindreårig mottaker)", false],
    ["guardian.lastName", "Foresattens etternavn (mindreårig mottaker)", false],
    ["guardian.gender", "Foresattens kjønn (mindreårig mottaker)", false],
    ["guardian.email", "Foresattens e-post (mindreårig mottaker)", false],
    ["guardian.phone", "Foresattens telefon (mindreårig mottaker)", false],
    ["consent", "Samtykke fra foresatt (mindreårig mottaker)", false],
    ["localGroup.region", "Region for mottaker", false],
    ["localGroup.chapter", "Lokallag for mottaker", false]
  ],
  craft: [
    ["business.name", "Bedriftsnavn", true],
    ["business.organizationNumber", "Organisasjonsnummer", true],
    ["business.address.street", "Bedriftens gateadresse", true],
    ["business.address.postalCode", "Bedriftens postnummer", true],
    ["business.address.city", "Bedriftens poststed", true],
    ["business.phone", "Bedriftens telefon", true],
    ["business.email", "Bedriftens e-post", true],
    ["business.website", "Hjemmeside", false],
    ["business.qualificationConfirmed", "Kvalifikasjonsbekreftelse", true],
    ["applicant.firstName", "Søkerens fornavn", true],
    ["applicant.middleName", "Søkerens mellomnavn", false],
    ["applicant.lastName", "Søkerens etternavn", true],
    ["applicant.gender", "Søkerens kjønn", true],
    ["applicant.email", "Søkerens e-post", true],
    ["applicant.phone", "Søkerens telefonnummer", true],
    ["applicant.birthDate", "Søkerens fødselsdato", true],
    ["applicant.address.street", "Søkerens gateadresse", true],
    ["applicant.address.postalCode", "Søkerens postnummer", true],
    ["applicant.address.city", "Søkerens poststed", true],
    ["craftType", "Håndverkstype", true],
    ["admissionMethod", "Opptaksmetode", true],
    ["files", "Dokumentasjon eller produktbilder", true],
    ["jury.education", "Relevant utdanning / realkompetanse", false],
    ["jury.practice", "Relevant praksis", false],
    ["jury.exhibitions", "Deltagelse på juryerte utstillinger", false],
    ["jury.awards", "Designpriser og lignende", false],
    ["jury.materials", "Materialer", false],
    ["jury.formColorDecoration", "Form, farge og dekor", false],
    ["jury.technique", "Fremstillingsteknikk", false],
    ["jury.use", "Bruksområde", false],
    ["jury.originality", "Originalitet", false],
    ["jury.photographs", "Vedlagte fotografier viser", false],
    ["localGroup.region", "Region for husflidslag", false],
    ["localGroup.chapter", "Lokallag for husflidslag", false],
    ["criteriaAccepted", "Bekreft medlemskriterier", true]
  ]
};

function defaultFields() {
  return Object.fromEntries(Object.entries(fieldDefinitions).map(([flow, definitions]) => [
    flow,
    Object.fromEntries(definitions.map(([key, label, required]) => [
      key,
      { visible: true, required, label }
    ]))
  ]));
}

function defaultOptions() {
  return {
    regular: { "person.gender": ["Mann", "Kvinne", "Annet"] },
    minor: { "child.gender": ["Mann", "Kvinne", "Annet"], "parent.gender": ["Mann", "Kvinne", "Annet"] },
    gift: {
      "purchaser.gender": ["Mann", "Kvinne", "Annet"],
      "recipient.gender": ["Mann", "Kvinne", "Annet"],
      "guardian.gender": ["Mann", "Kvinne", "Annet"]
    },
    craft: { "applicant.gender": ["Mann", "Kvinne", "Annet"] }
  };
}

const initialState = () => ({
  members: [],
  applications: [],
  sessions: [],
  config: {
    schemaVersion: 3,
    membershipTypes: { regular: true, minor: true, gift: true, craft: true },
    regions: [{ name: "Østfold", chapters: ["Fredrikstad", "Moss", "Sarpsborg"] }],
    addressLookupAvailable: false,
    fields: defaultFields(),
    requiredFields: Object.fromEntries(Object.entries(defaultFields()).map(([flow, fields]) => [
      flow, Object.entries(fields).filter(([, value]) => value.required).map(([key]) => key)
    ])),
    options: defaultOptions(),
    craftShippingInstructions: ""
  }
});

await mkdir(uploadDirectory, { recursive: true, mode: 0o700 });

let state;
try {
  state = JSON.parse(await readFile(storePath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  state = initialState();
}

if (!state || typeof state !== "object" || !Array.isArray(state.members) ||
    !Array.isArray(state.applications) || !Array.isArray(state.sessions)) {
  throw new Error("Application store has an invalid format");
}
const defaults = initialState().config;
const storedSchemaVersion = state.config?.schemaVersion || 0;
const migratingConfig = storedSchemaVersion < 2;
state.config = { ...defaults, ...(state.config || {}) };
if (migratingConfig && (!state.config.fields ||
    !Object.keys(state.config.fields).some((flow) => state.config.fields[flow]?.["person.firstName"]))) {
  state.config.fields = defaults.fields;
  state.config.requiredFields = defaults.requiredFields;
}
state.config.fields = Object.fromEntries(Object.keys(defaults.fields).map((flow) => [
  flow,
  { ...defaults.fields[flow], ...(state.config.fields?.[flow] || {}) }
]));
if (migratingConfig && (!Array.isArray(state.config.regions) || state.config.regions.length === 0)) {
  state.config.regions = defaults.regions;
}
state.config.options = Object.fromEntries(Object.keys(defaults.options).map((flow) => [
  flow,
  { ...defaults.options[flow], ...(state.config.options?.[flow] || {}) }
]));
state.config.requiredFields ??= defaults.requiredFields;
state.config.craftShippingInstructions ??= "";
state.config.addressLookupAvailable = false;
state.config.schemaVersion = 3;

let pendingWrite = Promise.resolve();

export function readStore() {
  return state;
}

export function updateStore(mutator) {
  const operation = pendingWrite.then(async () => {
    const result = await mutator(state);
    const nextPath = `${storePath}.next`;
    await writeFile(nextPath, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(nextPath, storePath);
    return result;
  });
  pendingWrite = operation.catch(() => {});
  return operation;
}
