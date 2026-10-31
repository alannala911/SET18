import express from "express";

export function contentRouter(items, notFoundMessage) {
  const router = express.Router();
  router.get("/", (req, res) => res.json(items));
  router.get("/:id", (req, res) => {
    const item = items.find((entry) => entry.id === Number(req.params.id));
    if (!item) return res.status(404).json({ message: notFoundMessage });
    res.json(item);
  });
  return router;
}
