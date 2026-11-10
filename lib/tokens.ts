import "server-only";
import { createHash, randomBytes } from "node:crypto";

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
