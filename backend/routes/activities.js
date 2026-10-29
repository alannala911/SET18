import express from "express";
import { activities } from "../data/content.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(activities);
});

router.get("/:id", (req, res) => {
  const activity = activities.find((item) => item.id === Number(req.params.id));

  if (!activity) {
    return res.status(404).json({ message: "Activity not found" });
  }

  res.json(activity);
});

export default router;
