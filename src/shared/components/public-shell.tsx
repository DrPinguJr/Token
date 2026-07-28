import { CircleHelp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { TokenlyMark } from "./tokenly-mark";

type PublicShellProps = Readonly<{
  children: ReactNode;
}>;

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_15%_5%,var(--tokenly-brand-blue-soft),transparent_36%),radial-gradient(circle_at_85%_12%,var(--tokenly-brand-pink-soft),transparent_32%)]"
      />

      <header className="relative z-10">
        <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link
            href="/"
            aria-label="Tokenly home"
            className="inline-flex min-h-11 min-w-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong"
          >
            <TokenlyMark />
          </Link>
          <Link
            href="/help"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white/75 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong"
          >
            <CircleHelp aria-hidden="true" className="size-4.5" />
            Help
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-ink/5 bg-white/45">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>Tokenly local event prototype</p>
          <p>Payments and bearer account links are not production-secured.</p>
        </div>
      </footer>
    </div>
  );
}
