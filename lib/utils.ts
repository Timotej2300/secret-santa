import { headers } from "next/headers";

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://secret-santa.vercel.app").replace(/\/$/, "");

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(new Date(d));
}

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("sk-SK", { dateStyle: "long", timeZone: "Europe/Bratislava" }).format(new Date(d));
}

export function fmtEur(n: number | string) {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(Number(n));
}

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });
export const ok = <T = unknown>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });

const TZ = "Europe/Bratislava";

function tzOffset(ts: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ts));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - ts;
}

/** "2026-12-24T18:00" (čas v Bratislave) -> ISO UTC */
export function localToIso(v?: string | null) {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return new Date(guess - tzOffset(guess)).toISOString();
}

export function isoToLocalInput(d?: string | null) {
  if (!d) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(d)).replace(" ", "T");
}
