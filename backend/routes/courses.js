import express from "express";
import { courses } from "../data/content.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(courses);
});

router.get("/:id", (req, res) => {
  const course = courses.find((item) => item.id === Number(req.params.id));

  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  res.json(course);
});

export default router;
