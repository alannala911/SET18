import express from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { readStore, updateStore } from "../lib/store.js";
import { createToken, normalizeEmail, tokenHash } from "../lib/security.js";

const router = express.Router();
const cookieName = "set18_admin_session";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const failedLogins = new Map();

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

export function requireAdmin(req, res, next) {
  const token = getCookie(req, cookieName);
  if (!token) return res.status(401).json({ message: "Authentication required" });
  const hashed = tokenHash(token);
  const session = readStore().sessions.find((item) =>
    item.kind === "admin" && item.tokenHash === hashed && Date.parse(item.expiresAt) > Date.now()
  );
  if (!session) return res.status(401).json({ message: "Authentication required" });
  req.admin = { email: session.email };
  req.sessionTokenHash = hashed;
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

router.post("/login", async (req, res, next) => {
  try {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      return res.status(503).json({ message: "Admin login is not configured" });
    }
    const email = normalizeEmail(req.body?.email).slice(0, 254);
    const password = req.body?.password;
    const key = `${req.ip}:${email}`;
    const attempts = failedLogins.get(key);
    if (attempts && attempts.count >= 10 && attempts.lockedUntil > Date.now()) {
      return res.status(429).json({ message: "Too many login attempts; try again later" });
    }
    const valid = email === adminEmail && matchingSecret(password, adminPassword);
    if (!valid) {
      recordFailure(key);
      return res.status(401).json({ message: "Invalid email or password" });
    }
    failedLogins.delete(key);
    const token = createToken();
    const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString();
    await updateStore((state) => {
      state.sessions = state.sessions.filter((session) => Date.parse(session.expiresAt) > Date.now());
      state.sessions.push({ kind: "admin", tokenHash: tokenHash(token), email: adminEmail, expiresAt });
    });
    res.cookie(cookieName, token, cookieOptions());
    res.json({ message: "Signed in", admin: { email: adminEmail } });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ authenticated: true, admin: req.admin });
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
    res.json({ message: "Signed out" });
  } catch (error) {
    next(error);
  }
});

export default router;
