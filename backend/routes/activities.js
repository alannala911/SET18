import express from "express";
import { readStore, updateStore } from "../lib/store.js";
import { requireAdmin } from "./auth.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(readStore().activities);
});

router.get("/:id", (req, res) => {
  const activity = readStore().activities.find((item) => item.id === Number(req.params.id));

  if (!activity) {
    return res.status(404).json({ message: "Activity not found" });
  }

  res.json(activity);
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "Activity id is invalid" });
    }
    const removed = await updateStore((state) => {
      const index = state.activities.findIndex((activity) => activity.id === id);
      if (index === -1) return false;
      state.activities.splice(index, 1);
      return true;
    });
    if (!removed) return res.status(404).json({ message: "Activity not found" });
    res.json({ message: "Activity removed" });
  } catch (error) {
    next(error);
  }
});

export default router;
