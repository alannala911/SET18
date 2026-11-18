// Håndterer applikasjonsdata med lokal JSON-lagring eller MySQL
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import {
  activities as defaultActivities,
  courses as defaultCourses,
  defaultContact,
  news as defaultNews,
} from "../data/content.js";

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
    ["address.street", "Gateadresse", true],
    ["address.postalCode", "Postnummer", true],
    ["address.city", "Poststed", true],
    ["localGroup.region", "Region", true],
    ["localGroup.chapter", "Lokallag", true],
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
    ["address.street", "Gateadresse", true],
    ["address.postalCode", "Postnummer", true],
    ["address.city", "Poststed", true],
    ["localGroup.region", "Region", true],
    ["localGroup.chapter", "Lokallag", true],
    ["consent", "Samtykke fra foresatt", true],
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
    [
      "guardian.middleName",
      "Foresattens mellomnavn (mindreårig mottaker)",
      false,
    ],
    ["guardian.lastName", "Foresattens etternavn (mindreårig mottaker)", false],
    ["guardian.gender", "Foresattens kjønn (mindreårig mottaker)", false],
    ["guardian.email", "Foresattens e-post (mindreårig mottaker)", false],
    ["guardian.phone", "Foresattens telefon (mindreårig mottaker)", false],
    ["consent", "Samtykke fra foresatt (mindreårig mottaker)", false],
    ["localGroup.region", "Region for mottaker", false],
    ["localGroup.chapter", "Lokallag for mottaker", false],
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
    ["criteriaAccepted", "Bekreft medlemskriterier", true],
  ],
};

function defaultFields() {
  return Object.fromEntries(
    Object.entries(fieldDefinitions).map(([flow, definitions]) => [
      flow,
      Object.fromEntries(
        definitions.map(([key, label, required]) => [
          key,
          { visible: true, required, label },
        ]),
      ),
    ]),
  );
}

function defaultOptions() {
  return {
    regular: { "person.gender": ["Mann", "Kvinne", "Annet"] },
    minor: {
      "child.gender": ["Mann", "Kvinne", "Annet"],
      "parent.gender": ["Mann", "Kvinne", "Annet"],
    },
    gift: {
      "purchaser.gender": ["Mann", "Kvinne", "Annet"],
      "recipient.gender": ["Mann", "Kvinne", "Annet"],
      "guardian.gender": ["Mann", "Kvinne", "Annet"],
    },
    craft: { "applicant.gender": ["Mann", "Kvinne", "Annet"] },
  };
}

function migrateNewsItem(item) {
  const { excerpt, body, publishedAt, ...newsData } = item;
  return {
    ...newsData,
    category: item.category || "Fra laget",
    summary: item.summary || excerpt || "",
    text: item.text || body || "",
    date: item.date || publishedAt || "",
    status: item.status || "published",
  };
}

const createInitialState = () => ({
  members: [],
  applications: [],
  sessions: [],
  contactSettings: structuredClone(defaultContact),
  contactMessages: [],
  activities: structuredClone(defaultActivities),
  courses: structuredClone(defaultCourses),
  news: structuredClone(defaultNews).map(migrateNewsItem),
  config: {
    schemaVersion: 3,
    membershipTypes: { regular: true, minor: true, gift: true, craft: true },
    regions: [
      { name: "Østfold", chapters: ["Fredrikstad", "Moss", "Sarpsborg"] },
    ],
    addressLookupAvailable: false,
    fields: defaultFields(),
    sections: { regular: {}, minor: {}, gift: {}, craft: {} },
    additionalFields: { regular: [], minor: [], gift: [], craft: [] },
    customForms: [],
    requiredFields: Object.fromEntries(
      Object.entries(defaultFields()).map(([flow, fields]) => [
        flow,
        Object.entries(fields)
          .filter(([, value]) => value.required)
          .map(([key]) => key),
      ]),
    ),
    options: defaultOptions(),
    craftShippingInstructions: "",
  },
});

async function readInitialStore() {
  try {
    return JSON.parse(await readFile(storePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return createInitialState();
  }
}

function mysqlConnectionOptions(connectionString) {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") {
    throw new Error("MYSQL_URL må bruke mysql://");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !database) {
    throw new Error("MYSQL_URL må inneholde vertsnavn og databasenavn");
  }
  return {
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    waitForConnections: true,
    connectionLimit: 10,
    ...(process.env.MYSQL_SSL === "true"
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  };
}

function parseDatabaseState(payload) {
  return typeof payload === "string" ? JSON.parse(payload) : payload;
}

function localUploadPath(storageName) {
  const filePath = path.resolve(uploadDirectory, storageName);
  if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) {
    throw new Error("Opplastingsbanen er ugyldig");
  }
  return filePath;
}

const pool = process.env.MYSQL_URL
  ? mysql.createPool(mysqlConnectionOptions(process.env.MYSQL_URL))
  : null;

if (process.env.NODE_ENV === "production" && !pool) {
  throw new Error(
    "MYSQL_URL må være konfigurert i produksjon; lokal JSON-lagring er deaktivert",
  );
}

function migrateConfig(state, defaults) {
  const storedSchemaVersion = state.config?.schemaVersion || 0;
  const migratingConfig = storedSchemaVersion < 2;
  state.config = { ...defaults, ...(state.config || {}) };

  const hasExistingPersonFields = Object.keys(state.config.fields || {}).some(
    (flow) => state.config.fields[flow]?.["person.firstName"],
  );
  if (migratingConfig && (!state.config.fields || !hasExistingPersonFields)) {
    state.config.fields = defaults.fields;
    state.config.requiredFields = defaults.requiredFields;
  }

  state.config.fields = Object.fromEntries(
    Object.keys(defaults.fields).map((flow) => [
      flow,
      { ...defaults.fields[flow], ...(state.config.fields?.[flow] || {}) },
    ]),
  );
  state.config.fields.minor["child.email"] = {
    ...state.config.fields.minor["child.email"],
    required: true,
  };
  state.config.fields.minor["child.phone"] = {
    ...state.config.fields.minor["child.phone"],
    required: true,
  };
  delete state.config.fields.minor.password;
  delete state.config.fields.minor.confirmPassword;

  const requiredFields = state.config.requiredFields || defaults.requiredFields;
  state.config.requiredFields = Object.fromEntries(
    Object.entries(requiredFields).map(([flow, fields]) => [
      flow,
      flow === "minor"
        ? [
            ...new Set([
              ...fields.filter(
                (field) => !["password", "confirmPassword"].includes(field),
              ),
              "child.email",
              "child.phone",
            ]),
          ]
        : fields,
    ]),
  );

  if (
    migratingConfig &&
    (!Array.isArray(state.config.regions) || state.config.regions.length === 0)
  ) {
    state.config.regions = defaults.regions;
  }
  state.config.options = Object.fromEntries(
    Object.keys(defaults.options).map((flow) => [
      flow,
      { ...defaults.options[flow], ...(state.config.options?.[flow] || {}) },
    ]),
  );
  state.config.additionalFields ??= defaults.additionalFields;
  state.config.sections ??= defaults.sections;
  state.config.customForms ??= defaults.customForms;
  state.config.craftShippingInstructions ??= "";
  state.config.addressLookupAvailable = false;
  state.config.schemaVersion = 4;
}

function migrateStore(state) {
  if (
    !state ||
    typeof state !== "object" ||
    !Array.isArray(state.members) ||
    !Array.isArray(state.applications) ||
    !Array.isArray(state.sessions)
  ) {
    throw new Error("Søknadsdatabasen har et ugyldig format");
  }
  if (state.activities === undefined)
    state.activities = structuredClone(defaultActivities);
  if (!Array.isArray(state.activities)) {
    throw new Error("Aktivitetene i søknadsdatabasen har et ugyldig format");
  }
  if (state.courses === undefined)
    state.courses = structuredClone(defaultCourses);
  if (!Array.isArray(state.courses)) {
    throw new Error("Kursene i søknadsdatabasen har et ugyldig format");
  }
  if (state.news === undefined) {
    state.news = structuredClone(defaultNews).map(migrateNewsItem);
  }
  if (!Array.isArray(state.news)) {
    throw new Error("Nyhetene i søknadsdatabasen har et ugyldig format");
  }
  state.news = state.news.map(migrateNewsItem);
  state.contactSettings ??= structuredClone(defaultContact);
  state.contactMessages ??= [];
  if (
    !state.contactSettings ||
    typeof state.contactSettings !== "object" ||
    !Array.isArray(state.contactSettings.people) ||
    !Array.isArray(state.contactMessages)
  ) {
    throw new Error("Kontaktopplysningene i søknadsdatabasen har et ugyldig format");
  }

  const defaults = createInitialState().config;
  migrateConfig(state, defaults);

  state.orders ??= [];
  state.auditLog ??= [];
  state.admins ??= [];
  if (state.adminAccount) {
    const ownerEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (ownerEmail && Object.keys(state.adminAccount).length) {
      state.admins.push({
        id: randomUUID(),
        email: ownerEmail,
        role: "owner",
        ...state.adminAccount,
      });
    }
    delete state.adminAccount;
  }
  return state;
}

await mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
let state = migrateStore(await readInitialStore());

if (pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS set18_application_state (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      payload JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS set18_uploads (
      storage_name VARCHAR(255) NOT NULL PRIMARY KEY,
      content LONGBLOB NOT NULL,
      content_type VARCHAR(100) NOT NULL
    )
  `);
  await pool.execute(
    "INSERT IGNORE INTO set18_application_state (id, payload) VALUES (1, ?)",
    [JSON.stringify(state)],
  );
  const [rows] = await pool.execute(
    "SELECT payload FROM set18_application_state WHERE id = 1",
  );
  if (!rows.length)
    throw new Error("Kunne ikke initialisere applikasjonsdata i MySQL");
  state = migrateStore(parseDatabaseState(rows[0].payload));
}

let pendingWrite = Promise.resolve();

function enqueue(operation) {
  const result = pendingWrite.then(operation);
  pendingWrite = result.catch(() => {});
  return result;
}

export function readStore() {
  return state;
}

export function refreshStore() {
  if (!pool) return Promise.resolve(state);
  return enqueue(async () => {
    const [rows] = await pool.execute(
      "SELECT payload FROM set18_application_state WHERE id = 1",
    );
    if (!rows.length) throw new Error("Applikasjonsdata mangler i MySQL");
    state = migrateStore(parseDatabaseState(rows[0].payload));
    return state;
  });
}

export function updateStore(mutator) {
  return enqueue(async () => {
    if (pool) {
      const connection = await pool.getConnection();
      let transactionStarted = false;
      try {
        await connection.beginTransaction();
        transactionStarted = true;
        const [rows] = await connection.execute(
          "SELECT payload FROM set18_application_state WHERE id = 1 FOR UPDATE",
        );
        if (!rows.length) throw new Error("Applikasjonsdata mangler i MySQL");
        const databaseState = migrateStore(parseDatabaseState(rows[0].payload));
        const result = await mutator(databaseState);
        await connection.execute(
          "UPDATE set18_application_state SET payload = ? WHERE id = 1",
          [JSON.stringify(databaseState)],
        );
        await connection.commit();
        transactionStarted = false;
        state = databaseState;
        return result;
      } catch (error) {
        if (transactionStarted) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            throw new AggregateError(
              [error, rollbackError],
              "MySQL-transaksjonen og tilbakerullingen feilet",
            );
          }
        }
        throw error;
      } finally {
        connection.release();
      }
    }

    const result = await mutator(state);
    const nextPath = `${storePath}.next`;
    await writeFile(nextPath, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(nextPath, storePath);
    return result;
  });
}

export async function saveUpload(storageName, content, contentType) {
  if (pool) {
    await pool.execute(
      `INSERT INTO set18_uploads (storage_name, content, content_type) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content), content_type = VALUES(content_type)`,
      [storageName, content, contentType],
    );
    return;
  }
  const filePath = localUploadPath(storageName);
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, content, { flag: "wx", mode: 0o600 });
}

export async function readUpload(storageName) {
  if (pool) {
    const [rows] = await pool.execute(
      "SELECT content FROM set18_uploads WHERE storage_name = ?",
      [storageName],
    );
    return rows.length ? rows[0].content : null;
  }
  try {
    return await readFile(localUploadPath(storageName));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteUpload(storageName) {
  if (pool) {
    await pool.execute("DELETE FROM set18_uploads WHERE storage_name = ?", [
      storageName,
    ]);
    return;
  }
  try {
    await unlink(localUploadPath(storageName));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
