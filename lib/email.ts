import "server-only";
import { Resend } from "resend";
import { admin } from "@/lib/supabase/admin";
import { APP_URL, esc, fmtDateTime, fmtEur } from "@/lib/utils";

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html lang="sk"><body style="margin:0;background:#faf6ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f2a1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border-radius:24px;overflow:hidden;border:1px solid #e8e4d6">
<tr><td style="background:#1f4d36;padding:22px 28px"><span style="display:inline-block;background:#c9a24a;color:#0f2a1d;font-weight:800;border-radius:10px;padding:6px 9px;font-size:14px;letter-spacing:.5px">SS</span>
<span style="color:#fff;font-weight:700;letter-spacing:2px;font-size:14px;margin-left:10px">SECRET SANTA</span></td></tr>
<tr><td style="padding:32px 28px 8px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#173d2a">${esc(title)}</h1>${body}</td></tr>
${cta ? `<tr><td style="padding:8px 28px 28px"><a href="${esc(cta.url)}" style="display:inline-block;background:#1f4d36;color:#fff;text-decoration:none;font-weight:700;letter-spacing:.5px;border-radius:14px;padding:14px 26px;font-size:14px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding:18px 28px;background:#f3efe2;color:#6b7a70;font-size:12px">Tím SECRET SANTA 🎅<br>Tento e-mail neobsahuje tajné priradenia.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${t}</p>`;

export type GroupInfo = { name: string; min_gift_value: number | string; gift_deadline: string | null };

export const templates = {
  invitation(a: { first_name: string; last_name: string; group: GroupInfo; url: string; infoUrl: string }) {
    return {
      subject: "🎅 Bol/a si pridaný/á do SECRET SANTA!",
      html: layout(
        `Ahoj, ${a.first_name}!`,
        p(`Bol/a si pridaný/á do skupiny <b>${esc(a.group.name)}</b> v SECRET SANTA.`) +
          p("Teraz už stačí dokončiť registráciu a pripraviť sa na vianočné prekvapenie! Secret Santa je tajné vianočné obdarovanie: každý dostane jednu osobu, ktorej kúpi darček.") +
          `<table role="presentation" style="background:#f3efe2;border-radius:16px;padding:14px 18px;margin:0 0 16px;font-size:14px;line-height:1.8;width:100%"><tr><td>
<b>Informácie o skupine</b><br>Účastník: ${esc(a.first_name)} ${esc(a.last_name)}<br>Skupina: ${esc(a.group.name)}<br>Minimálna hodnota darčeka: ${fmtEur(a.group.min_gift_value)}<br>Termín odovzdania: ${esc(fmtDateTime(a.group.gift_deadline))}</td></tr></table>` +
          p(`Podrobné informácie: <a href="${esc(a.infoUrl)}" style="color:#1f4d36">zobraziť pravidlá skupiny</a>`) +
          p("Klikni na tlačidlo nižšie a dokonči registráciu.") +
          p("Tešíme sa na spoločnú vianočnú atmosféru!"),
        { label: "DOKONČIŤ REGISTRÁCIU", url: a.url },
      ),
    };
  },
  organizerInvite(a: { first_name: string; url: string; existing?: boolean }) {
    return {
      subject: "🎄 Pozvánka za organizátora SECRET SANTA",
      html: layout(
        `Ahoj, ${a.first_name}!`,
        p(a.existing ? "Tvoj účet v SECRET SANTA dostal rolu organizátora. Po prihlásení nájdeš v hlavičke odkaz na organizátorský panel." : "Bol/a si pridaný/á ako organizátor v SECRET SANTA. Cez tlačidlo nižšie si vytvoríš heslo a získaš prístup do administrácie."),
        { label: a.existing ? "PRIHLÁSIŤ SA" : "VYTVORIŤ HESLO", url: a.url },
      ),
    };
  },
  registrationConfirmed(a: { first_name: string; group: string }) {
    return { subject: `✅ Registrácia potvrdená – ${a.group}`, html: layout(`Registrácia dokončená, ${a.first_name}!`, p(`Si zaregistrovaný/á v skupine <b>${esc(a.group)}</b>. Prihlás sa a vyber si spôsob odovzdania darčeka.`), { label: "OTVORIŤ MÔJ PANEL", url: `${APP_URL}/dashboard` }) };
  },
  drawDone(a: { first_name: string; group: string }) {
    return { subject: `🎁 Losovanie je hotové – ${a.group}`, html: layout(`Losovanie prebehlo, ${a.first_name}!`, p(`V skupine <b>${esc(a.group)}</b> prebehlo losovanie. Prihlás sa a odkry svojho Secret Santa príjemcu na stieracom lístku.`) + p("Meno príjemcu z bezpečnostných dôvodov neposielame e-mailom."), { label: "ODKRYŤ PRÍJEMCU", url: `${APP_URL}/dashboard` }) };
  },
  infoChanged(a: { first_name: string; group: string }) {
    return { subject: `📝 Zmena informácií skupiny ${a.group}`, html: layout(`Informácie skupiny sa zmenili`, p(`Ahoj ${esc(a.first_name)}, organizátor upravil dôležité informácie v skupine <b>${esc(a.group)}</b>. Pozri si aktuálne znenie.`), { label: "ZOBRAZIŤ INFORMÁCIE", url: `${APP_URL}/dashboard` }) };
  },
  receiverChanged(a: { first_name: string; group: string }) {
    return { subject: `🔄 Zmena tvojho príjemcu – ${a.group}`, html: layout(`Tvoj príjemca sa zmenil`, p(`Ahoj ${esc(a.first_name)}, tvoj pôvodný príjemca opustil skupinu <b>${esc(a.group)}</b>. Bude ti pridelený nový príjemca – nájdeš ho vo svojom paneli.`), { label: "OTVORIŤ MÔJ PANEL", url: `${APP_URL}/dashboard` }) };
  },
  giftGiven(a: { first_name: string; group: string }) {
    return { subject: `🎁 Tvoj darček bol odovzdaný – ${a.group}`, html: layout(`Darček je na ceste!`, p(`Ahoj ${esc(a.first_name)}, tvoj Secret Santa označil, že ti odovzdal darček. Po prevzatí ho prosím potvrď vo svojom paneli.`), { label: "POTVRDIŤ PRIJATIE", url: `${APP_URL}/dashboard` }) };
  },
  giftReceived(a: { first_name: string; group: string }) {
    return { subject: `✅ Príjemca potvrdil darček – ${a.group}`, html: layout(`Darček bol prijatý`, p(`Ahoj ${esc(a.first_name)}, tvoj príjemca potvrdil, že darček dostal. Ďakujeme, že si pomohol/pomohla vytvoriť vianočnú atmosféru!`)) };
  },
  reminder(a: { first_name: string; group: string; deadline: string | null }) {
    return { subject: `⏰ Blíži sa termín odovzdania – ${a.group}`, html: layout(`Pripomenutie termínu`, p(`Ahoj ${esc(a.first_name)}, termín odovzdania darčekov v skupine <b>${esc(a.group)}</b> je ${esc(fmtDateTime(a.deadline))}.`), { label: "OTVORIŤ MÔJ PANEL", url: `${APP_URL}/dashboard` }) };
  },
  supportReply(a: { first_name: string; subject: string; body: string }) {
    return { subject: `💬 Odpoveď podpory: ${a.subject}`, html: layout(`Nová odpoveď na tvoju požiadavku`, p(`Ahoj ${esc(a.first_name)},`) + `<blockquote style="margin:0 0 14px;padding:12px 16px;background:#f3efe2;border-radius:12px;font-size:14px;white-space:pre-wrap">${esc(a.body)}</blockquote>`, { label: "OTVORIŤ PODPORU", url: `${APP_URL}/podpora` }) };
  },
};

let resend: Resend | null = null;

export async function sendEmail(opts: { to: string; template: string; subject: string; html: string; groupId?: string | null }): Promise<SendResult> {
  const db = admin();
  let result: SendResult;
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error("Resend nie je nakonfigurovaný (RESEND_API_KEY / EMAIL_FROM).");
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from: process.env.EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html });
    if (error) throw new Error(error.message);
    result = { ok: true, id: data?.id ?? null };
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "Chyba odosielania" };
  }
  await db.from("email_logs").insert({
    to_email: opts.to,
    template: opts.template,
    group_id: opts.groupId ?? null,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
    resend_message_id: result.ok ? result.id : null,
  } as never);
  return result;
}
