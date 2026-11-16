// Tester API-funksjoner for medlemskap, innlogging, kurs og aktiviteter
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const adminLogin = { email: "admin@test.no", password: "AdminPassord1234" };
const memberLogin = { email: "ola@test.no", password: "Passord123456" };
const registration = {
  birthDate: "1990-01-01",
  person: {
    firstName: "Ola",
    lastName: "Nordmann",
    gender: "Mann",
    email: memberLogin.email,
    phone: "91234567",
  },
  address: { street: "Gata 1", postalCode: "1670", city: "Kråkerøy" },
  localGroup: { region: "Østfold", chapter: "Moss" },
  password: memberLogin.password,
  confirmPassword: memberLogin.password,
  termsAccepted: true,
};
const activity = {
  title: "Strikkekurs",
  date: "2099-01-01",
  time: "10:00",
  location: "Moss",
  category: "Kurs",
  description: "",
  ticketCapacity: 5,
  discount: {
    type: "percent",
    value: 50,
    memberTypes: ["regular"],
    startDate: "",
    endDate: "",
  },
  ticketTypes: [
    {
      name: "Voksen",
      description: "",
      price: 200,
      quantity: 4,
      memberTypes: ["regular"],
    },
  ],
};

let server;
let dataDirectory;
let baseUrl;

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer().listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function client() {
  let cookies = "";
  return async (route, { method = "GET", body, form } = {}) => {
    const response = await fetch(`${baseUrl}/api${route}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookies ? { Cookie: cookies } : {}),
      },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookies = setCookie.split(";")[0];
    return {
      status: response.status,
      data: await response.json().catch(() => ({})),
    };
  };
}

function activityForm(overrides = {}) {
  const form = new FormData();
  form.set("activity", JSON.stringify({ ...activity, ...overrides }));
  return form;
}

before(async () => {
  dataDirectory = await mkdtemp(path.join(os.tmpdir(), "set18-test-"));
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDirectory,
      NODE_ENV: "test",
      MYSQL_URL: "",
      ADMIN_EMAIL: adminLogin.email,
      ADMIN_PASSWORD: adminLogin.password,
    },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (
      await fetch(`${baseUrl}/api/health`).then(
        (response) => response.ok,
        () => false,
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Serveren startet ikke");
});

after(async () => {
  server.kill();
  await rm(dataDirectory, { recursive: true, force: true });
});

test("den offentlige aktivitetslisten fungerer med standardaktivitetene", async () => {
  const health = await fetch(`${baseUrl}/api/health`).then((response) =>
    response.json(),
  );
  assert.equal(health.status, "ok");
  assert.equal(health.storage, "local");
  const list = await fetch(`${baseUrl}/api/activities`).then((response) =>
    response.json(),
  );
  assert.ok(Array.isArray(list));
});

test("passerte kurs og aktiviteter arkiveres og er kun tilgjengelige for administrator", async () => {
  const admin = client();
  const visitor = client();
  await admin("/auth/login", { method: "POST", body: adminLogin });
  const courseData = {
    title: "Tidligere testkurs", category: "Veving", description: "Testkurs",
    date: "2000-01-01", time: "12:00", place: "Moss", price: 100,
    symbol: "K", color: "wool", status: "published",
  };
  const createdCourse = await admin("/courses", { method: "POST", body: courseData });
  const createdActivity = await admin("/activities", { method: "POST", form: activityForm({ title: "Tidligere aktivitet", date: "2000-01-01", status: "published" }) });
  assert.equal(createdCourse.status, 201);
  assert.equal(createdActivity.status, 201);
  assert.equal(createdCourse.data.status, "archived");
  assert.equal(createdActivity.data.status, "archived");
  for (const [type, created] of [["courses", createdCourse], ["activities", createdActivity]]) {
    assert.equal((await visitor(`/${type}`)).data.some((item) => item.id === created.data.id), false);
    assert.equal((await visitor(`/${type}?scope=all`)).data.some((item) => item.id === created.data.id), false);
    assert.equal((await visitor(`/${type}/${created.data.id}`)).status, 404);
    assert.equal((await admin(`/${type}?scope=all`)).data.find((item) => item.id === created.data.id).status, "archived");
    assert.equal((await admin(`/${type}/${created.data.id}`)).status, 200);
  }
  const saved = JSON.parse(await readFile(path.join(dataDirectory, "application-store.json"), "utf8"));
  assert.equal(saved.courses.find((item) => item.id === createdCourse.data.id).status, "archived");
  assert.equal(saved.activities.find((item) => item.id === createdActivity.data.id).status, "archived");
  const republishedCourse = await admin(`/courses/${createdCourse.data.id}`, {
    method: "PUT", body: { ...courseData, date: "2099-01-01" },
  });
  assert.equal(republishedCourse.data.status, "published");
  const republishedActivity = await admin(`/activities/${createdActivity.data.id}`, {
    method: "PUT", form: activityForm({ title: "Tidligere aktivitet", date: "2099-01-01", status: "published" }),
  });
  assert.equal(republishedActivity.data.status, "published");
  assert.equal((await visitor(`/courses/${createdCourse.data.id}`)).status, 200);
  assert.equal((await visitor(`/activities/${createdActivity.data.id}`)).status, 200);
});

test("kontaktinformasjon kan bare redigeres av administrator og meldinger lagres i admininnboksen", async () => {
  const initialSettings = await fetch(`${baseUrl}/api/contact/settings`).then(
    (response) => response.json(),
  );
  assert.equal(initialSettings.email, "ostfoldhusflid@gmail.com");
  assert.ok(initialSettings.people.length > 0);

  const updatedSettings = {
    ...initialSettings,
    introduction: "Ta kontakt med Østfold Husflidslag.",
    people: [
      {
        id: "test-contact",
        name: "Test Kontakt",
        role: "Testrolle",
        email: "kontakt@test.no",
        phone: "900 00 001",
      },
    ],
  };
  assert.equal(
    (
      await fetch(`${baseUrl}/api/contact/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      })
    ).status,
    401,
  );

  const message = {
    name: "Testbruker",
    email: "bruker@test.no",
    topic: "annet",
    message: "Dette er en testmelding.",
  };
  const submitted = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  assert.equal(submitted.status, 201);
  assert.match((await submitted.json()).message, /sendt til administratorene/);

  const anonymousMessages = await fetch(`${baseUrl}/api/contact/messages`);
  assert.equal(anonymousMessages.status, 401);

  const admin = client();
  await admin("/auth/login", { method: "POST", body: adminLogin });
  const savedSettings = await admin("/contact/settings", {
    method: "PUT",
    body: updatedSettings,
  });
  assert.equal(savedSettings.status, 200);
  assert.equal(savedSettings.data.people[0].email, "kontakt@test.no");
  assert.equal((await admin("/contact/settings")).data.people.length, 1);
  assert.equal(
    (await admin("/contact/messages")).data[0].message,
    message.message,
  );

  const invalidMessage = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, email: "invalid" }),
  });
  assert.equal(invalidMessage.status, 400);

  const messageId = (await admin("/contact/messages")).data[0].id;
  assert.equal(
    (await admin(`/contact/messages/${messageId}`, { method: "DELETE" })).status,
    200,
  );
  assert.equal((await admin("/contact/messages")).data.length, 0);
});

test("aktivitetsbilletter avviser priser som ikke er positive tall", async () => {
  const admin = client();
  await admin("/auth/login", { method: "POST", body: adminLogin });

  for (const price of ["200", "200 kr", "1e2", "0x10", "$200", -1, 0, null, true]) {
    const response = await admin("/activities", {
      method: "POST",
      form: activityForm({
        ticketTypes: [{ ...activity.ticketTypes[0], price }],
      }),
    });
    assert.equal(response.status, 400, `pris ${JSON.stringify(price)} skal avvises`);
  }
});

test("produksjonsserveren starter ikke med lokal lagring", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "set18-production-test-"),
  );
  try {
    const result = spawnSync(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        MYSQL_URL: "",
        DATA_DIR: temporaryDirectory,
      },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MYSQL_URL må være konfigurert i produksjon/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

describe("administrator", () => {
  test("avviser feil passord og godtar riktig", async () => {
    const admin = client();
    assert.equal(
      (
        await admin("/auth/login", {
          method: "POST",
          body: { ...adminLogin, password: "feil" },
        })
      ).status,
      401,
    );
    const login = await admin("/auth/login", {
      method: "POST",
      body: adminLogin,
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.admin.role, "owner");
  });

  test("administratorer kan legge til og fjerne administratorer, men ikke hovedadministratoren", async () => {
    const owner = client();
    await owner("/auth/login", { method: "POST", body: adminLogin });
    const created = await owner("/auth/admins", {
      method: "POST",
      body: { email: "b@test.no", password: "AndreAdmin1234" },
    });
    assert.equal(created.status, 201);

    const second = client();
    await second("/auth/login", {
      method: "POST",
      body: { email: "b@test.no", password: "AndreAdmin1234" },
    });
    assert.equal((await second("/auth/admins")).status, 200);
    const anotherCreated = await second("/auth/admins", {
      method: "POST",
      body: { email: "c@test.no", password: "TredjeAdmin1234" },
    });
    assert.equal(anotherCreated.status, 201);

    const removableAdmin = await second("/auth/admins", {
      method: "POST",
      body: { email: "d@test.no", password: "FjerdeAdmin1234" },
    });
    assert.equal(removableAdmin.status, 201);
    assert.equal(
      (
        await second(`/auth/admins/${removableAdmin.data.id}`, {
          method: "DELETE",
        })
      ).status,
      200,
    );
    assert.equal(
      (await owner(`/auth/admins/${created.data.id}`, { method: "DELETE" }))
        .status,
      200,
    );
    assert.equal((await second("/auth/me")).status, 401);

    const remainingAdmin = client();
    await remainingAdmin("/auth/login", {
      method: "POST",
      body: { email: "c@test.no", password: "TredjeAdmin1234" },
    });
    const ownerRecord = (await remainingAdmin("/auth/admins")).data.find(
      (item) => item.role === "owner",
    );
    assert.ok(ownerRecord);
    assert.equal(
      (
        await remainingAdmin(`/auth/admins/${ownerRecord.id}`, {
          method: "DELETE",
        })
      ).status,
      404,
    );
  });
});

describe("nyhetsadministrasjon", () => {
  test("administratorer kan opprette, forhåndsvise, publisere og arkivere nyheter", async () => {
    const anonymous = client();
    const newsData = {
      title: "Test av nyhetsflyten",
      category: "Fra laget",
      summary: "En test av ingressen.",
      text: "Nyhetstekst med flere detaljer.",
      date: "2099-01-02",
      imageUrl: "",
      status: "draft",
    };
    assert.equal(
      (
        await anonymous("/news", {
          method: "POST",
          body: newsData,
        })
      ).status,
      401,
    );

    const admin = client();
    await admin("/auth/login", { method: "POST", body: adminLogin });
    const invalid = await admin("/news", {
      method: "POST",
      body: { ...newsData, date: "2099-02-31" },
    });
    assert.equal(invalid.status, 400);

    const created = await admin("/news", {
      method: "POST",
      body: newsData,
    });
    assert.equal(created.status, 201);
    const newsId = created.data.id;
    assert.equal(created.data.status, "draft");
    assert.equal(
      (await fetch(`${baseUrl}/api/news/${newsId}`)).status,
      404,
    );
    const publicNews = await fetch(`${baseUrl}/api/news`).then((response) =>
      response.json(),
    );
    assert.equal(publicNews.some((item) => item.id === newsId), false);
    assert.equal((await admin(`/news/${newsId}`)).data.title, newsData.title);

    const imageSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const form = new FormData();
    form.set("news", JSON.stringify({ ...newsData, status: "published" }));
    form.set("image", new Blob([imageSignature], { type: "image/png" }), "news.png");
    const updated = await admin(`/news/${newsId}`, {
      method: "PUT",
      form,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.status, "published");
    assert.equal(updated.data.imageUrl, `/api/news/images/${updated.data.imageStorageName}`);
    const imageResponse = await fetch(`${baseUrl}${updated.data.imageUrl}`);
    assert.equal(imageResponse.status, 200);
    assert.deepEqual(
      Buffer.from(await imageResponse.arrayBuffer()),
      imageSignature,
    );
    assert.equal((await fetch(`${baseUrl}/api/news/${newsId}`)).status, 200);

    assert.equal((await admin(`/news/${newsId}`, { method: "DELETE" })).status, 200);
    assert.equal(
      (await fetch(`${baseUrl}/api/news/${newsId}`)).status,
      404,
    );
    assert.equal(
      (await admin("/news?scope=all")).data.find((item) => item.id === newsId)
        .status,
      "archived",
    );
  });
});

describe("medlemmer og bestillinger", () => {
  let admin;
  let member;
  let activityId;
  let createdActivityImageUrl;

  before(async () => {
    admin = client();
    await admin("/auth/login", { method: "POST", body: adminLogin });
    member = client();
  });

  test("registrering krever vilkår og avviser duplikater", async () => {
    const withoutTerms = await member("/membership/regular", {
      method: "POST",
      body: { ...registration, termsAccepted: false },
    });
    assert.equal(withoutTerms.status, 400);
    assert.equal(
      (
        await member("/membership/regular", {
          method: "POST",
          body: registration,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await member("/membership/regular", {
          method: "POST",
          body: registration,
        })
      ).status,
      409,
    );
  });

  test("innlogging gir tilgang til Min side", async () => {
    assert.equal((await member("/membership/me")).status, 401);
    assert.equal(
      (await member("/membership/login", { method: "POST", body: memberLogin }))
        .status,
      200,
    );
    const me = await member("/membership/me");
    assert.equal(me.data.member.expired, false);
  });

  test("bestilling bruker rabatt og respekterer kapasitet", async () => {
    const form = activityForm();
    const imageSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    form.set(
      "image",
      new Blob([imageSignature], { type: "image/png" }),
      "activity.png",
    );
    const created = await admin("/activities", { method: "POST", form });
    assert.equal(created.status, 201);
    activityId = created.data.id;
    createdActivityImageUrl = created.data.imageUrl;
    const imageResponse = await fetch(`${baseUrl}${created.data.imageUrl}`);
    assert.equal(imageResponse.status, 200);
    assert.deepEqual(
      Buffer.from(await imageResponse.arrayBuffer()),
      imageSignature,
    );

    const order = await member("/membership/orders", {
      method: "POST",
      body: { activityId, ticketName: "Voksen", quantity: 2 },
    });
    assert.equal(order.status, 201);
    assert.equal(order.data.unitPrice, 100);
    assert.equal(order.data.totalPrice, 200);

    const tooMany = await member("/membership/orders", {
      method: "POST",
      body: { activityId, ticketName: "Voksen", quantity: 3 },
    });
    assert.equal(tooMany.status, 409);

    const publicActivity = await fetch(
      `${baseUrl}/api/activities/${activityId}`,
    ).then((response) => response.json());
    assert.equal(publicActivity.remainingTickets.byType.Voksen, 2);
  });

  test("solgte billetter kan ikke fjernes ved redigering", async () => {
    const lowered = await admin(`/activities/${activityId}`, {
      method: "PUT",
      form: activityForm({
        ticketTypes: [{ ...activity.ticketTypes[0], quantity: 1 }],
      }),
    });
    assert.equal(lowered.status, 409);
  });

  test("avbestilling frigjør billetter", async () => {
    const [order] = (await member("/membership/orders")).data;
    assert.equal(
      (await member(`/membership/orders/${order.id}`, { method: "DELETE" }))
        .status,
      200,
    );
    assert.equal(
      (await member(`/membership/orders/${order.id}`, { method: "DELETE" }))
        .status,
      409,
    );
  });

  test("utløpt medlemskap kan ikke kjøpe før fornyelse", async () => {
    const [{ id }] = (await admin("/admin/members")).data.members;
    await admin(`/admin/members/${id}`, {
      method: "PATCH",
      body: { validUntil: "2020-01-01" },
    });
    const blocked = await member("/membership/orders", {
      method: "POST",
      body: { activityId, ticketName: "Voksen", quantity: 1 },
    });
    assert.equal(blocked.status, 403);
    assert.equal(
      (await member("/membership/me/renew", { method: "POST", body: {} }))
        .status,
      200,
    );
    assert.equal(
      (
        await member("/membership/orders", {
          method: "POST",
          body: { activityId, ticketName: "Voksen", quantity: 1 },
        })
      ).status,
      201,
    );
  });

  test("utkast og arkiverte aktiviteter vises bare for administrator", async () => {
    await admin(`/activities/${activityId}`, {
      method: "PUT",
      form: activityForm({ status: "draft" }),
    });
    const publicList = await fetch(`${baseUrl}/api/activities`).then(
      (response) => response.json(),
    );
    assert.equal(
      publicList.some((item) => item.id === activityId),
      false,
    );
    assert.equal(
      (await admin("/activities?scope=all")).data.some(
        (item) => item.id === activityId,
      ),
      true,
    );

    await admin(`/activities/${activityId}`, { method: "DELETE" });
    const all = (await admin("/activities?scope=all")).data;
    assert.equal(all.find((item) => item.id === activityId).status, "archived");
    assert.equal((await fetch(`${baseUrl}${createdActivityImageUrl}`)).status, 404);
    const orders = (await member("/membership/orders")).data;
    assert.ok(orders.every((order) => order.status === "cancelled"));
  });

  test("passordbytte og sletting av medlemskap", async () => {
    const newPassword = "NyttPassord12345";
    assert.equal(
      (
        await member("/membership/me/password", {
          method: "POST",
          body: { currentPassword: "feil", newPassword },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await member("/membership/me/password", {
          method: "POST",
          body: { currentPassword: memberLogin.password, newPassword },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await member("/membership/me", {
          method: "DELETE",
          body: { password: newPassword },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await client()("/membership/login", {
          method: "POST",
          body: { email: memberLogin.email, password: newPassword },
        })
      ).status,
      401,
    );
  });

  test("administrative handlinger havner i revisjonsloggen", async () => {
    const { entries } = (await admin("/admin/audit-log")).data;
    const actions = entries.map((entry) => entry.action);
    for (const expected of [
      "activity.create",
      "activity.update",
      "activity.archive",
      "member.update",
    ]) {
      assert.ok(actions.includes(expected), expected);
    }
  });
});

describe("kurs", () => {
  const courseDraft = {
    title: "Testkurs i veving",
    category: "Veving",
    description: "Et kurs for å teste administrering av kurs.",
    date: "2099-03-15",
    time: "17:00–20:00",
    place: "Moss",
    price: 400,
    symbol: "🧵",
    color: "wool",
    status: "draft",
  };

  test("administratorer kan opprette, forhåndspublisere, redigere og arkivere kurs", async () => {
    const admin = client();
    const visitor = client();
    assert.equal(
      (await admin("/courses", { method: "POST", body: courseDraft })).status,
      401,
    );
    await admin("/auth/login", { method: "POST", body: adminLogin });

    for (const price of ["400", "400 kr", "1e2", "0x10", "$400", -1, 0, null, true]) {
      const invalidPrice = await admin("/courses", {
        method: "POST",
        body: { ...courseDraft, price },
      });
      assert.equal(invalidPrice.status, 400, `pris ${JSON.stringify(price)} skal avvises`);
    }

    const created = await admin("/courses", {
      method: "POST",
      body: courseDraft,
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.price, 400);
    const courseId = created.data.id;
    assert.equal(created.data.status, "draft");
    assert.equal(
      (await visitor("/courses")).data.some((course) => course.id === courseId),
      false,
    );
    assert.equal(
      (await admin("/courses?scope=all")).data.some(
        (course) => course.id === courseId,
      ),
      true,
    );
    assert.equal((await visitor(`/courses/${courseId}`)).status, 404);

    const invalidUpdate = await admin(`/courses/${courseId}`, {
      method: "PUT",
      body: { ...courseDraft, date: "2099-02-31" },
    });
    assert.equal(invalidUpdate.status, 400);

    const updated = await admin(`/courses/${courseId}`, {
      method: "PUT",
      body: {
        ...courseDraft,
        title: "Oppdatert testkurs",
        status: "published",
      },
    });
    assert.equal(updated.status, 200);
    assert.equal(
      (await visitor(`/courses/${courseId}`)).data.title,
      "Oppdatert testkurs",
    );

    assert.equal(
      (await admin(`/courses/${courseId}`, { method: "DELETE" })).status,
      200,
    );
    assert.equal(
      (await visitor("/courses")).data.some((course) => course.id === courseId),
      false,
    );
    assert.equal(
      (await admin("/courses?scope=all")).data.find(
        (course) => course.id === courseId,
      ).status,
      "archived",
    );
  });
});
