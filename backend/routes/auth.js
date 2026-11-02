import express from "express";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readStore, updateStore } from "../lib/store.js";
import { createToken, hashPassword, normalizeEmail, tokenHash, validEmail, verifyPassword } from "../lib/security.js";
import { recordAudit } from "../lib/audit.js";
import { adminProfile } from "../lib/members.js";
import { changePassword, saveLocalGroup, sendProfileChangeLink } from "./membership.js";

const router = express.Router();
const cookieName = "set18_admin_session";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const failedLogins = new Map();
const minimumPasswordLength = 12;
const dummyPasswordHash = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
const findAdmin = (state, email) => state.admins.find((admin) => admin.email === email);

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: sessionLifetimeMs
  };
}

function getCookie(req, name) {
  const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

export function adminSession(req) {
  const token = getCookie(req, cookieName);
  if (!token) return null;
  const sessionTokenHash = tokenHash(token);
  const state = readStore();
  const session = state.sessions.find((item) =>
    item.kind === "admin" && item.tokenHash === sessionTokenHash && Date.parse(item.expiresAt) > Date.now()
  );
  const admin = session && findAdmin(state, session.email);
  return admin ? { email: admin.email, role: admin.role, sessionTokenHash } : null;
}

export function requireAdmin(req, res, next) {
  const session = adminSession(req);
  if (!session) return res.status(401).json({ message: "Innlogging kreves" });
  req.admin = { email: session.email, role: session.role };
  req.sessionTokenHash = session.sessionTokenHash;
  next();
}

function matchingSecret(input, configured) {
  if (typeof input !== "string" || typeof configured !== "string") return false;
  const submitted = createHash("sha256").update(input).digest();
  const expected = createHash("sha256").update(configured).digest();
  return timingSafeEqual(submitted, expected);
}

function recordFailure(key) {
  if (!failedLogins.has(key) && failedLogins.size >= 5000) {
    failedLogins.delete(failedLogins.keys().next().value);
  }
  const current = failedLogins.get(key) || { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= 10) current.lockedUntil = Date.now() + 15 * 60 * 1000;
  failedLogins.set(key, current);
}

async function verifyAdminLogin(email, password) {
  const ownerEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const ownerPassword = process.env.ADMIN_PASSWORD;
  const stored = findAdmin(readStore(), email);
  if (stored?.passwordHash) return verifyPassword(password.slice(0, 200), stored.passwordHash);
  await verifyPassword(password.slice(0, 200), dummyPasswordHash);
  const isOwnerSeed = ownerEmail && ownerPassword && email === ownerEmail && matchingSecret(password, ownerPassword);
  if (!isOwnerSeed) return false;
  const passwordHash = await hashPassword(password);
  await updateStore((state) => {
    const owner = findAdmin(state, email);
    if (owner) Object.assign(owner, { passwordHash, role: "owner" });
    else state.admins.push({ id: randomUUID(), email, role: "owner", passwordHash, createdAt: new Date().toISOString() });
  });
  return true;
}

router.post("/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email).slice(0, 254);
    const password = req.body?.password;
    const key = `${req.ip}:${email}`;
    const attempts = failedLogins.get(key);
    if (attempts && attempts.count >= 10 && attempts.lockedUntil > Date.now()) {
      return res.status(429).json({ message: "For mange innloggingsforsøk. Prøv igjen senere." });
    }
    if (typeof password !== "string" || !(await verifyAdminLogin(email, password))) {
      recordFailure(key);
      return res.status(401).json({ message: "Ugyldig e-postadresse eller passord" });
    }
    failedLogins.delete(key);
    const token = createToken();
    const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString();
    await updateStore((state) => {
      state.sessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > Date.now());
      state.sessions.push({ kind: "admin", tokenHash: tokenHash(token), email, expiresAt });
    });
    res.cookie(cookieName, token, cookieOptions());
    res.json({ message: "Logget inn", admin: { email, role: findAdmin(readStore(), email).role } });
  } catch (error) {
    next(error);
  }
});

const ownAccount = (req) => (state) => findAdmin(state, req.admin.email);

router.get("/me", requireAdmin, (req, res) => {
  res.json({ authenticated: true, admin: { ...req.admin, profile: adminProfile(findAdmin(readStore(), req.admin.email)) } });
});

router.post("/profile/change-request", requireAdmin, (req, res, next) => {
  sendProfileChangeLink(res, req.admin.email, ownAccount(req)).catch(next);
});

router.patch("/me/local-group", requireAdmin, (req, res, next) => {
  saveLocalGroup(req, res, ownAccount(req), (account) => ({ profile: adminProfile(account) })).catch(next);
});

router.post("/me/password", requireAdmin, (req, res, next) => {
  changePassword(req, res, ownAccount(req)).catch(next);
});

const publicAdmin = ({ id, email, role, createdAt }) => ({ id, email, role, createdAt });

router.get("/admins", requireAdmin, (req, res) => {
  res.json(readStore().admins.map(publicAdmin));
});

router.post("/admins", requireAdmin, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!validEmail(email)) return res.status(400).json({ message: "Oppgi en gyldig e-postadresse" });
    if (typeof password !== "string" || password.length < minimumPasswordLength || password.length > 200) {
      return res.status(400).json({ message: `Passordet må være mellom ${minimumPasswordLength} og 200 tegn` });
    }
    const passwordHash = await hashPassword(password);
    const created = await updateStore((state) => {
      if (findAdmin(state, email)) return null;
      const admin = { id: randomUUID(), email, role: "admin", passwordHash, createdAt: new Date().toISOString() };
      state.admins.push(admin);
      recordAudit(state, req, "admin.add", { target: email });
      return admin;
    });
    if (!created) return res.status(409).json({ message: "Administratoren finnes allerede" });
    res.status(201).json(publicAdmin(created));
  } catch (error) {
    next(error);
  }
});

router.delete("/admins/:id", requireAdmin, async (req, res, next) => {
  try {
    const removed = await updateStore((state) => {
      const admin = state.admins.find((item) => item.id === req.params.id);
      if (!admin || admin.role === "owner") return null;
      state.admins = state.admins.filter((item) => item !== admin);
      state.sessions = state.sessions.filter((session) => session.email !== admin.email);
      recordAudit(state, req, "admin.remove", { target: admin.email });
      return admin;
    });
    if (!removed) return res.status(404).json({ message: "Administratoren ble ikke funnet, eller er hovedadministrator" });
    res.json({ message: "Administratoren er fjernet" });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = getCookie(req, cookieName);
    if (token) {
      const hashed = tokenHash(token);
      await updateStore((state) => {
        state.sessions = state.sessions.filter((session) => session.tokenHash !== hashed);
      });
    }
    res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
    res.json({ message: "Logget ut" });
  } catch (error) {
    next(error);
  }
});

export default router;
