import "server-only";
import { admin } from "@/lib/supabase/admin";

export async function audit(actorId: string | null, action: string, opts: { entity?: string; entityId?: string; groupId?: string | null; meta?: Record<string, unknown> } = {}) {
  await admin().from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity: opts.entity ?? null,
    entity_id: opts.entityId ?? null,
    group_id: opts.groupId ?? null,
    meta: (opts.meta ?? {}) as never,
  } as never);
}
