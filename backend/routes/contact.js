import express from "express";
import { randomUUID } from "node:crypto";
import { readStore, updateStore } from "../lib/store.js";
import { recordAudit } from "../lib/audit.js";
import { rateLimit } from "../lib/rateLimit.js";
import { requireAdmin } from "./auth.js";

const router = express.Router();
const contactTopics = new Set(["kurs", "aktiviteter", "lokallag", "annet"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^[+()\d\s.-]{5,30}$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readContactSettings(input, res) {
  if (
    !isRecord(input) ||
    typeof input.introduction !== "string" ||
    typeof input.email !== "string" ||
    typeof input.phone !== "string" ||
    typeof input.address !== "string" ||
    !Array.isArray(input.people) ||
    input.people.length > 100
  ) {
    res.status(400).json({ message: "Kontaktinformasjonen har et ugyldig format." });
    return null;
  }
  const { introduction, email, phone, address } = input;
  if (
    !introduction.trim() ||
    introduction.length > 500 ||
    !emailPattern.test(email.trim()) ||
    email.length > 254 ||
    !phonePattern.test(phone.trim()) ||
    address.trim().length === 0 ||
    address.length > 500
  ) {
    res.status(400).json({ message: "Kontroller introduksjon, e-post, telefon og adresse." });
    return null;
  }

  const people = [];
  const ids = new Set();
  for (const person of input.people) {
    if (
      !isRecord(person) ||
      typeof person.id !== "string" ||
      !person.id.trim() ||
      person.id.length > 100 ||
      ids.has(person.id) ||
      typeof person.name !== "string" ||
      !person.name.trim() ||
      person.name.length > 100 ||
      typeof person.role !== "string" ||
      !person.role.trim() ||
      person.role.length > 120 ||
      typeof person.email !== "string" ||
      !emailPattern.test(person.email.trim()) ||
      person.email.length > 254 ||
      typeof person.phone !== "string" ||
      !phonePattern.test(person.phone.trim())
    ) {
      res.status(400).json({ message: "En eller flere kontaktpersoner har ugyldige opplysninger." });
      return null;
    }
    ids.add(person.id);
    people.push({
      id: person.id.trim(),
      name: person.name.trim(),
      role: person.role.trim(),
      email: person.email.trim(),
      phone: person.phone.trim(),
    });
  }

  return {
    introduction: introduction.trim(),
    email: email.trim(),
    phone: phone.trim(),
    address: address.trim(),
    people,
  };
}

router.get("/settings", (req, res) => {
  res.json(readStore().contactSettings);
});

router.put("/settings", requireAdmin, async (req, res, next) => {
  const settings = readContactSettings(req.body, res);
  if (!settings) return;
  try {
    const savedSettings = await updateStore((state) => {
      state.contactSettings = settings;
      recordAudit(state, req, "contact.settings.update", {
        contactPeople: settings.people.length,
      });
      return state.contactSettings;
    });
    res.json(savedSettings);
  } catch (error) {
    next(error);
  }
});

router.get("/messages", requireAdmin, (req, res) => {
  res.json(readStore().contactMessages);
});

router.delete("/messages/:id", requireAdmin, async (req, res, next) => {
  try {
    const deleted = await updateStore((state) => {
      const messageIndex = state.contactMessages.findIndex(
        (item) => item.id === req.params.id,
      );
      if (messageIndex === -1) return false;
      state.contactMessages.splice(messageIndex, 1);
      recordAudit(state, req, "contact.message.delete");
      return true;
    });
    if (!deleted) {
      return res.status(404).json({ message: "Meldingen ble ikke funnet." });
    }
    res.json({ message: "Meldingen er slettet." });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  rateLimit({
    max: 5,
    windowMs: 60 * 60 * 1000,
    message: "For mange meldinger. Prøv igjen senere.",
  }),
  async (req, res, next) => {
    const { name, email, topic, message, website } = req.body || {};
    if (typeof website === "string" && website.trim()) {
      return res.status(201).json({ message: "Meldingen er sendt." });
    }
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof email !== "string" ||
      !emailPattern.test(email.trim()) ||
      email.length > 254 ||
      !contactTopics.has(topic) ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 3000
    ) {
      return res.status(400).json({
        message: "Oppgi navn, gyldig e-post, tema og en melding på maksimalt 3000 tegn.",
      });
    }

    try {
      await updateStore((state) => {
        state.contactMessages.unshift({
          id: randomUUID(),
          name: name.trim(),
          email: email.trim(),
          topic,
          message: message.trim(),
          receivedAt: new Date().toISOString(),
        });
        state.contactMessages = state.contactMessages.slice(0, 500);
      });
      res.status(201).json({
        message: "Takk for meldingen! Den er sendt til administratorene.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
