import express from "express";
import cors from "cors";

import activitiesRoutes from "./routes/activities.js";
import coursesRoutes from "./routes/courses.js";
import newsRoutes from "./routes/news.js";
import municipalitiesRoutes from "./routes/municipalities.js";
import contactRoutes from "./routes/contact.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Østfold Husflidslag backend" });
});

app.use("/api/activities", activitiesRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/municipalities", municipalitiesRoutes);
app.use("/api/contact", contactRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Something went wrong" });
});

app.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});
