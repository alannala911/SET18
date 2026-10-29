import express from "express";
import { news } from "../data/content.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(news);
});

router.get("/:id", (req, res) => {
  const item = news.find((entry) => entry.id === Number(req.params.id));

  if (!item) {
    return res.status(404).json({ message: "News item not found" });
  }

  res.json(item);
});

export default router;
