import express from "express";

const router = express.Router();

router.post("/", (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Navn, e-postadresse og melding er påkrevd"
    });
  }

  res.status(201).json({
    message: "Henvendelsen er mottatt",
    submitted: {
      name,
      email,
      message
    }
  });
});

export default router;
