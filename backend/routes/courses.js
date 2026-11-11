import express from "express";
import { adminSession, requireAdmin } from "./auth.js";
import { readStore, updateStore } from "../lib/store.js";
import { recordAudit } from "../lib/audit.js";

const router = express.Router();
const courseStatuses = new Set(["published", "draft", "archived"]);
const courseColors = new Set([
  "basket",
  "wool",
  "sewing",
  "embroidery",
  "knitting",
  "christmas",
]);

function getCourseId(req, res) {
  const courseId = Number(req.params.id);
  if (!Number.isSafeInteger(courseId) || courseId < 1) {
    res.status(400).json({ message: "Kurs-ID-en er ugyldig" });
    return null;
  }
  return courseId;
}

function readCourseData(req, res) {
  const course = req.body;
  const requiredTextFields = [
    "title",
    "category",
    "description",
    "date",
    "time",
    "place",
    "price",
    "symbol",
    "color",
  ];
  if (
    !course ||
    typeof course !== "object" ||
    Array.isArray(course) ||
    requiredTextFields.some(
      (field) => typeof course[field] !== "string" || !course[field].trim(),
    )
  ) {
    res.status(400).json({ message: "Fyll ut alle obligatoriske kursfelt." });
    return null;
  }
  if (
    course.title.length > 160 ||
    course.category.length > 100 ||
    course.description.length > 5000 ||
    course.time.length > 80 ||
    course.place.length > 200 ||
    course.price.length > 80 ||
    course.symbol.length > 20 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(course.date) ||
    !courseColors.has(course.color) ||
    !courseStatuses.has(course.status)
  ) {
    res
      .status(400)
      .json({ message: "Et eller flere kursfelt har ugyldige verdier." });
    return null;
  }
  const parsedDate = new Date(`${course.date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== course.date
  ) {
    res.status(400).json({ message: "Kursdatoen er ugyldig." });
    return null;
  }
  return {
    ...Object.fromEntries(
      requiredTextFields.map((field) => [field, course[field].trim()]),
    ),
    status: course.status,
  };
}

router.get("/", (req, res) => {
  const courses = readStore().courses;
  res.json(
    req.query.scope === "all" && adminSession(req)
      ? courses
      : courses.filter((course) => course.status === "published"),
  );
});

router.get("/:id", (req, res) => {
  const courseId = getCourseId(req, res);
  if (!courseId) return;
  const course = readStore().courses.find((item) => item.id === courseId);
  if (!course || (course.status !== "published" && !adminSession(req))) {
    return res.status(404).json({ message: "Kurset ble ikke funnet" });
  }
  res.json(course);
});

router.post("/", requireAdmin, async (req, res, next) => {
  const courseData = readCourseData(req, res);
  if (!courseData) return;
  try {
    const course = await updateStore((state) => {
      const newCourse = {
        id: Math.max(0, ...state.courses.map((item) => item.id)) + 1,
        ...courseData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.courses.push(newCourse);
      recordAudit(state, req, "course.create", {
        courseId: newCourse.id,
        title: newCourse.title,
      });
      return newCourse;
    });
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  const courseId = getCourseId(req, res);
  if (!courseId) return;
  const courseData = readCourseData(req, res);
  if (!courseData) return;
  try {
    const course = await updateStore((state) => {
      const existingCourse = state.courses.find((item) => item.id === courseId);
      if (!existingCourse) return null;
      Object.assign(existingCourse, courseData, {
        updatedAt: new Date().toISOString(),
      });
      recordAudit(state, req, "course.update", {
        courseId,
        title: existingCourse.title,
      });
      return existingCourse;
    });
    if (!course)
      return res.status(404).json({ message: "Kurset ble ikke funnet" });
    res.json(course);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  const courseId = getCourseId(req, res);
  if (!courseId) return;
  try {
    const course = await updateStore((state) => {
      const existingCourse = state.courses.find((item) => item.id === courseId);
      if (!existingCourse) return null;
      existingCourse.status = "archived";
      existingCourse.updatedAt = new Date().toISOString();
      recordAudit(state, req, "course.archive", {
        courseId,
        title: existingCourse.title,
      });
      return existingCourse;
    });
    if (!course)
      return res.status(404).json({ message: "Kurset ble ikke funnet" });
    res.json({ message: "Kurset er arkivert" });
  } catch (error) {
    next(error);
  }
});

export default router;
