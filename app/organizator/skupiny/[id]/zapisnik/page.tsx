import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { canManageGroup, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { APP_URL, fmtDate } from "@/lib/utils";
import { PrintButton } from "@/components/Misc";

export const metadata = { title: "Účastnícky zápisník" };
export const dynamic = "force-dynamic";

export default async function Notebook({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireUser();
  const { id } = await params;
  if (!(await canManageGroup(s, id))) notFound();
  const db = admin();
  const { data } = await db.from("groups").select("name,max_participants").eq("id", id).single();
  const g = data as { name: string; max_participants: number };
  const { data: qr } = await db.from("group_qr_tokens").select("token").eq("group_id", id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const url = qr ? `${APP_URL}/skupina/${(qr as { token: string }).token}` : "";
  const svg = url ? await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#173d2a", light: "#0000" } }) : "";
  const rows = Array.from({ length: g.max_participants }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-end"><PrintButton label="Vytlačiť" /></div>
      <div className="border-t-4 border-forest-700 pt-4">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-forest-800">SECRET SANTA – ÚČASTNÍCKY ZÁPISNÍK</h1>
        <div className="mt-2 flex justify-between text-sm text-forest-900/70"><span><b>Skupina:</b> {g.name}</span><span><b>Dátum:</b> {fmtDate(new Date())}</span></div>
      </div>
      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-forest-50">
            <th className="w-10 border border-forest-200 px-2 py-2 text-left">#</th>
            <th className="border border-forest-200 px-2 py-2 text-left">Meno a priezvisko</th>
            <th className="border border-forest-200 px-2 py-2 text-left">E-mail</th>
            <th className="border border-forest-200 px-2 py-2 text-left">Telefón (nepovinný)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n} style={{ breakInside: "avoid" }}>
              <td className="border border-forest-200 px-2 text-forest-900/50" style={{ height: "9.5mm" }}>{n}</td>
              <td className="border border-forest-200" />
              <td className="border border-forest-200" />
              <td className="border border-forest-200" />
            </tr>
          ))}
        </tbody>
      </table>
      {svg && (
        <div className="mt-8 text-center" style={{ breakInside: "avoid" }}>
          <div className="mx-auto w-36" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-2 text-sm font-medium text-forest-800">Naskenuj QR kód a zaregistruj sa do skupiny.</p>
        </div>
      )}
    </div>
  );
}
