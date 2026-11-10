"use client";
import { useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import type { ActionResult } from "@/lib/utils";

type Action = (fd: FormData) => Promise<ActionResult<{ redirect?: string } | unknown>>;

/** Formulár volajúci server action, so stavom načítavania, toastom a voliteľným presmerovaním. */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: { action: Action; children: ReactNode; className?: string; resetOnSuccess?: boolean; confirm?: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(fd);
          if (!r.ok) return toast("err", r.error);
          if (r.message) toast("ok", r.message);
          if (resetOnSuccess) ref.current?.reset();
          const to = (r.data as { redirect?: string } | undefined)?.redirect;
          if (to) router.push(to);
          router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">{children}</fieldset>
    </form>
  );
}

export function Submit({ children, className = "btn-primary", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  return (
    <button type="submit" className={className}>
      {children}
      {pendingText ? null : null}
    </button>
  );
}

export function Spinner() {
  return <Loader2 className="animate-spin" size={16} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/** Tlačidlo, ktoré zavolá server action s ľubovoľnými argumentmi. */
export function ActionButton({ run, children, className = "btn-ghost", confirm }: { run: () => Promise<ActionResult<unknown>>; children: ReactNode; className?: string; confirm?: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await run();
          if (!r.ok) return toast("err", r.error);
          if (r.message) toast("ok", r.message);
          router.refresh();
        });
      }}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
