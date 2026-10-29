import express from "express";

const router = express.Router();

router.post("/", (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Name, email and message are required"
    });
  }

  res.status(201).json({
    message: "Contact request received",
    submitted: {
      name,
      email,
      message
    }
  });
});

export default router;
