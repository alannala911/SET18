import express from "express";
import { municipalities } from "../data/content.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json(municipalities);
});

router.get("/:id", (req, res) => {
  const municipality = municipalities.find(
    (item) => item.id === Number(req.params.id)
  );

  if (!municipality) {
    return res.status(404).json({ message: "Municipality not found" });
  }

  res.json(municipality);
});

export default router;
