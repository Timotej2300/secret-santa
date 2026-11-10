import "server-only";
import { admin } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/utils";

/** Vráti true, ak je požiadavka povolená. Pri chybe DB zlyhá bezpečne (zamietne). */
export async function rateLimit(name: string, max: number, windowSeconds: number, extraKey?: string) {
  const ip = await clientIp();
  const key = `${name}:${ip}${extraKey ? ":" + extraKey : ""}`;
  const { data, error } = await admin().rpc("check_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) return false;
  return data === true;
}

export const TOO_MANY = "Príliš veľa pokusov. Skús to prosím o chvíľu.";
