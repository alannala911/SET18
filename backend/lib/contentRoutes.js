// Oppretter offentlige leseruter for statisk innhold
import express from "express";

export function contentRouter(items, notFoundMessage) {
  const router = express.Router();
  // Delte, skrivebeskyttede ruter brukes for innhold som ikke har administratorredigering
  router.get("/", (req, res) => res.json(items));
  router.get("/:id", (req, res) => {
    const item = items.find((entry) => entry.id === Number(req.params.id));
    if (!item) return res.status(404).json({ message: notFoundMessage });
    res.json(item);
  });
  return router;
}
