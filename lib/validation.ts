import { z } from "zod";

const name = z.string().trim().min(1, "Povinné pole").max(60);
export const emailSchema = z.string().trim().toLowerCase().email("Neplatný e-mail").max(254);
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+0-9 ()\-]*$/, "Neplatné telefónne číslo")
  .optional()
  .or(z.literal(""));

export const personSchema = z.object({ first_name: name, last_name: name, email: emailSchema, phone });
export const passwordSchema = z.string().min(10, "Heslo musí mať aspoň 10 znakov").max(128);

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Názov je príliš krátky").max(120),
  description: z.string().trim().max(1000).default(""),
  max_participants: z.coerce.number().int().min(4).max(30),
  min_gift_value: z.coerce.number().min(0).max(10000),
  gift_deadline: z.string().optional().nullable(),
  rules: z.string().trim().max(8000).default(""),
  phone_required: z.coerce.boolean().default(false),
});

export const wishSchema = z.object({
  title: z.string().trim().min(1, "Zadaj názov").max(140),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  url: z.string().trim().url().regex(/^https?:\/\//i).max(500).optional().or(z.literal("")),
  image_url: z.string().trim().url().regex(/^https:\/\//i, "Obrázok musí byť HTTPS").max(500).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  clothing_size: z.string().trim().max(30).optional().or(z.literal("")),
  favorite_color: z.string().trim().max(40).optional().or(z.literal("")),
});

export const deliverySchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("in_person"), note: z.string().trim().max(500).optional(), meeting_place: z.string().trim().max(200).optional() }),
  z.object({
    method: z.literal("address"),
    address_line: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(100),
    postal_code: z.string().trim().min(3).max(12),
    country: z.string().trim().min(2).max(60),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({ method: z.literal("via_person"), via_person_name: z.string().trim().min(2).max(120), note: z.string().trim().max(500).optional() }),
]);

export function firstError(e: z.ZodError) {
  return e.issues[0]?.message || "Neplatné údaje";
}

export function formObject(fd: FormData) {
  const o: Record<string, unknown> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}
