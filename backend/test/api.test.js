import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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
  assert.ok(Array.isArray(list) && list.length > 0);
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

describe("medlemmer og bestillinger", () => {
  let admin;
  let member;
  let activityId;

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
    price: "400 kr",
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

    const created = await admin("/courses", {
      method: "POST",
      body: courseDraft,
    });
    assert.equal(created.status, 201);
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
