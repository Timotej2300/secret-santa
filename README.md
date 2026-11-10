# SECRET SANTA

Next.js (App Router) · TypeScript · Tailwind CSS 4 · Supabase · Resend · Vercel

## Lokálne spustenie

```bash
npm install
cp .env.example .env.local      # doplň hodnoty
npm run dev                      # http://localhost:3000
```

## 1. Supabase

1. Vytvor projekt na https://supabase.com.
2. SQL Editor → vlož a spusti celý súbor `supabase/migrations/0001_init.sql`.
3. Project Settings → API → skopíruj:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (nikdy nie do klienta, iba do Vercel env a `.env.local`)
4. Authentication → Providers → Email: ponechaj zapnuté; „Confirm email" môže byť vypnuté (e-mail overuje pozvánka). Registrácia je iba cez pozvánku, preto v Authentication → Sign In / Providers vypni **„Allow new users to sign up"**, aby sa nedalo registrovať priamo cez Supabase API.

## 2. Owner účet

Owner sa vytvára iba na serveri skriptom (v DB platí unikátny index – môže existovať iba jeden Owner):

```bash
OWNER_PASSWORD="silne-heslo-min-12-znakov" node --env-file=.env.local node_modules/.bin/tsx scripts/init-owner.ts
```

Skript použije `OWNER_EMAIL` z `.env.local` (`timotejvnencak931@gmail.com`).

## 3. Resend

1. Účet na https://resend.com → API Keys → `RESEND_API_KEY`.
2. Domains → pridaj svoju doménu a nastav DNS záznamy (SPF, DKIM) podľa Resend. Bez overenej domény Resend posiela iba na tvoj vlastný e-mail.
3. `EMAIL_FROM="SECRET SANTA <noreply@tvoja-domena.sk>"`.
4. Stav „Doručený / Otvorený": Resend → Webhooks → Add endpoint `https://secret-santa.vercel.app/api/webhooks/resend`, udalosti `email.delivered`, `email.opened`, `email.bounced`; signing secret (`whsec_…`) → `RESEND_WEBHOOK_SECRET`. Sledovanie otvorení treba zapnúť v nastaveniach domény.

## 4. Vercel

1. Nahraj projekt na GitHub, vo Verceli: Add New → Project → vyber repozitár.
2. Settings → Environment Variables (Production + Preview):

| Premenná | Hodnota |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | z Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | z Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | z Supabase (secret) |
| `RESEND_API_KEY` | z Resend |
| `EMAIL_FROM` | `SECRET SANTA <noreply@tvoja-domena.sk>` |
| `NEXT_PUBLIC_APP_URL` | `https://secret-santa.vercel.app` (alebo tvoja doména) |
| `OWNER_EMAIL` | `timotejvnencak931@gmail.com` |
| `RESEND_WEBHOOK_SECRET` | z Resend webhooku |
| `CRON_SECRET` | ľubovoľný dlhý náhodný reťazec (Vercel ho posiela cronu ako Bearer) |

3. Deploy. Denný cron (`vercel.json`) posiela pripomienky termínu a označuje expirované pozvánky.

## Bezpečnosť v skratke

- Všetky dáta idú cez server s kontrolou oprávnení; `SUPABASE_SERVICE_ROLE_KEY` je iba v `lib/supabase/admin.ts` (`server-only`).
- RLS je zapnuté na všetkých tabuľkách; `assignments`, `gift_confirmations`, `rate_limits` nemajú klientske politiky.
- Meno príjemcu sa do prehliadača dostane až server actionom po odstieraní.
- Pozvánkové tokeny sa ukladajú iba ako SHA-256 hash, sú jednorazové a expirujú po 7 dňoch.
- Heslá spravuje Supabase Auth.

## Testy

```bash
npm run test:draw   # algoritmus losovania: 4, 6, 8, 10, 20, 30 účastníkov × 2000 losovaní
npm run typecheck
```
