import express from "express";
import cors from "cors";

import activitiesRoutes from "./routes/activities.js";
import coursesRoutes from "./routes/courses.js";
import newsRoutes from "./routes/news.js";
import municipalitiesRoutes from "./routes/municipalities.js";
import contactRoutes from "./routes/contact.js";
import ordersRoutes from "./routes/orders.js";
import membershipRoutes from "./routes/membership.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";

const app = express();
const PORT = process.env.PORT || 3000;
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || defaultOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
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
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Østfold Husflidslag backend" });
});

app.use("/api/activities", activitiesRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/municipalities", municipalitiesRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/membership/orders", ordersRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

function handleRequestError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Forespørselen må inneholde gyldig JSON" });
  }
  console.error(error.message);
  res.status(500).json({ message: "Noe gikk galt" });
}

app.use(handleRequestError);

app.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});
