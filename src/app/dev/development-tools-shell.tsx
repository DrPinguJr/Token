import type { ReactNode } from "react";

import { TokenlyMark } from "@/shared/components/tokenly-mark";

import { DevelopmentToolsNavigation } from "./development-tools-navigation";

type DevelopmentToolsShellProps = Readonly<{
  children: ReactNode;
}>;

export function DevelopmentToolsShell({
  children,
}: DevelopmentToolsShellProps) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-ink/5 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <TokenlyMark />
          <span className="rounded-full bg-brand-pink-soft px-3 py-1.5 text-xs font-bold tracking-[0.08em] text-brand-pink-strong uppercase">
            Development only
          </span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:px-8 lg:py-10">
        <DevelopmentToolsNavigation />

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
