import { AppShell } from "@/components/app-shell";

export default function Page() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute -top-[140px] left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-ember-500/[0.06] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-[160px] -right-[80px] h-[380px] w-[480px] rounded-full bg-lilac-400/[0.04] blur-[100px]" />

      <div className="relative flex h-dvh w-full max-w-[420px] flex-col overflow-hidden bg-ink-900 sm:h-[min(880px,96dvh)] sm:rounded-[38px] sm:border sm:border-white/10 sm:shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)]">
        <AppShell />
      </div>

      <p className="absolute bottom-5 right-6 hidden font-display text-[11px] font-semibold tracking-[0.22em] text-fog-600 lg:block">
        LEDGER · PLAN LIKE IT MATTERS
      </p>
    </div>
  );
}
