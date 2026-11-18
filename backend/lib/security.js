// Inneholder hjelpefunksjoner for e-postadresser, passord og sikkerhetstokener
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof encoded !== "string") return false;
  const [algorithm, saltHex, hashHex] = encoded.split(":");
  if (
    algorithm !== "scrypt" ||
    !/^[0-9a-f]{32}$/i.test(saltHex || "") ||
    !/^[0-9a-f]{128}$/i.test(hashHex || "")
  )
    return false;
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(hashHex, "hex"));
}

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}
