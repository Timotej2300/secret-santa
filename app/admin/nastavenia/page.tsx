import { requireRole } from "@/lib/auth";
import { Badge, PageTitle } from "@/components/ui";
import { APP_URL } from "@/lib/utils";

export const metadata = { title: "Nastavenia platformy" };
export const dynamic = "force-dynamic";

export default async function PlatformSettings() {
  await requireRole("owner");
  const rows: [string, boolean, string?][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", !!process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", !!process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["RESEND_API_KEY", !!process.env.RESEND_API_KEY],
    ["EMAIL_FROM", !!process.env.EMAIL_FROM, process.env.EMAIL_FROM],
    ["RESEND_WEBHOOK_SECRET (stav doručenia/otvorenia)", !!process.env.RESEND_WEBHOOK_SECRET],
    ["CRON_SECRET (pripomienky termínov)", !!process.env.CRON_SECRET],
    ["NEXT_PUBLIC_APP_URL", !!process.env.NEXT_PUBLIC_APP_URL, APP_URL],
  ];
  return (
    <>
      <PageTitle title="Nastavenia platformy" subtitle="Stav konfigurácie (hodnoty kľúčov sa nezobrazujú)" />
      <div className="card">
        <ul className="divide-y divide-forest-900/5 text-sm">
          {rows.map(([k, set, v]) => (
            <li key={k} className="flex items-center justify-between gap-3 py-3"><span className="font-mono text-xs">{k}</span><span className="flex items-center gap-2 text-xs text-forest-900/60">{v}<Badge tone={set ? "green" : "red"}>{set ? "nastavené" : "chýba"}</Badge></span></li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-forest-900/50">Webhook Resend: <span className="font-mono">{APP_URL}/api/webhooks/resend</span></p>
      </div>
    </>
  );
}
