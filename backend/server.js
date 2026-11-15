import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import activitiesRoutes from "./routes/activities.js";
import coursesRoutes from "./routes/courses.js";
import newsRoutes from "./routes/news.js";
import municipalitiesRoutes from "./routes/municipalities.js";
import contactRoutes from "./routes/contact.js";
import ordersRoutes from "./routes/orders.js";
import membershipRoutes from "./routes/membership.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import { readStore, refreshStore, updateStore } from "./lib/store.js";
import { archivePastContent, shouldArchive } from "./lib/contentArchive.js";

const app = express();
const PORT = process.env.PORT || 3000;
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

if (process.env.NODE_ENV === "production") {
  const requiredSettings = [
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "CORS_ORIGINS",
    "PUBLIC_FRONTEND_URL",
  ];
  const missingSettings = requiredSettings.filter(
    (setting) => !process.env[setting]?.trim(),
  );
  if (missingSettings.length) {
    throw new Error(
      `Disse miljøvariablene må settes i produksjon: ${missingSettings.join(", ")}`,
    );
  }
  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD må være minst 12 tegn i produksjon");
  }

  const origins = process.env.CORS_ORIGINS.split(",").map((origin) =>
    origin.trim(),
  );
  const validOrigins = origins.every((origin) => {
    try {
      const url = new URL(origin);
      return url.protocol === "https:" && url.origin === origin;
    } catch {
      return false;
    }
  });
  let frontendUrl;
  try {
    frontendUrl = new URL(process.env.PUBLIC_FRONTEND_URL);
  } catch {
    throw new Error(
      "PUBLIC_FRONTEND_URL må være en gyldig HTTPS-adresse i produksjon",
    );
  }
  if (
    !validOrigins ||
    frontendUrl.protocol !== "https:" ||
    !origins.includes(frontendUrl.origin)
  ) {
    throw new Error(
      "CORS_ORIGINS må inneholde HTTPS-opprinnelsen til PUBLIC_FRONTEND_URL",
    );
  }
}

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || defaultOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  const origin = req.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ message: "Nettadressen er ikke tillatt" });
  }
  next();
});
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
  try {
    await refreshStore();
    res.json({
      status: "ok",
      service: "Østfold Husflidslag backend",
      storage: process.env.MYSQL_URL ? "mysql" : "local",
    });
  } catch (error) {
    console.error(`Health check failed: ${error.message}`);
    res
      .status(503)
      .json({ status: "unavailable", service: "Østfold Husflidslag backend" });
  }
});

async function archiveExpiredContent() {
  await refreshStore();
  const state = readStore();
  if (state.courses.some((item) => shouldArchive(item)) ||
      state.activities.some((item) => shouldArchive(item))) {
    await updateStore((current) => archivePastContent(current));
  }
}

app.use((req, res, next) => {
  archiveExpiredContent().then(() => next(), next);
});

const archiveTimer = setInterval(() => {
  archiveExpiredContent().catch((error) => {
    console.error(`Automatisk arkivering feilet: ${error.message}`);
  });
}, 60_000);
archiveTimer.unref();

app.use("/api/activities", activitiesRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/municipalities", municipalitiesRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/membership/orders", ordersRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

const frontendDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../frontend/dist",
);
app.use(express.static(frontendDist));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

function handleRequestError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res
      .status(400)
      .json({ message: "Forespørselen må inneholde gyldig JSON" });
  }
  console.error(error.message);
  res.status(500).json({ message: "Noe gikk galt" });
}

app.use(handleRequestError);

app.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});
