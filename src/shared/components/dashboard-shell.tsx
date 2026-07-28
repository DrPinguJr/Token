import { CircleHelp, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { TokenlyMark } from "./tokenly-mark";

export type ShellNavigationItem = Readonly<{
  href: string;
  label: string;
  icon: ReactNode;
  isActive?: boolean;
  badge?: string;
}>;

type DashboardShellProps = Readonly<{
  children: ReactNode;
  navigation: readonly ShellNavigationItem[];
  roleLabel: string;
  accountName: string;
  homeHref: string;
  pageTitle?: string;
  actions?: ReactNode;
}>;

function NavigationLink({
  item,
  mobile = false,
}: Readonly<{
  item: ShellNavigationItem;
  mobile?: boolean;
}>) {
  if (mobile) {
    return (
      <Link
        href={item.href}
        aria-current={item.isActive ? "page" : undefined}
        className={`relative flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-blue-strong ${
          item.isActive
            ? "bg-brand-blue-soft font-bold text-brand-blue-strong before:absolute before:top-0.5 before:h-1 before:w-5 before:rounded-full before:bg-brand-blue-strong"
            : "text-ink-muted hover:bg-canvas-soft hover:text-ink"
        }`}
      >
        <span aria-hidden="true" className="[&>svg]:size-5">
          {item.icon}
        </span>
        <span className="max-w-full truncate">{item.label}</span>
        {item.badge && (
          <span className="absolute top-0.5 left-[calc(50%+0.35rem)] grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-pink-strong px-1 text-sm leading-none font-bold text-white">
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={item.isActive ? "page" : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong ${
        item.isActive
          ? "bg-brand-blue-soft font-bold text-brand-blue-strong shadow-[inset_3px_0_0_var(--tokenly-brand-blue-strong)]"
          : "text-ink-muted hover:bg-canvas-soft hover:text-ink"
      }`}
    >
      <span aria-hidden="true" className="[&>svg]:size-5">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-pink-soft px-1.5 text-xs font-bold text-brand-pink-strong">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function DashboardShell({
  children,
  navigation,
  roleLabel,
  accountName,
  homeHref,
  pageTitle,
  actions,
}: DashboardShellProps) {
  const mobileNavigation = navigation.slice(0, 5);

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink/5 bg-white/82 px-5 py-6 backdrop-blur lg:flex">
        <Link
          href={homeHref}
          aria-label={`${roleLabel} home`}
          className="inline-flex min-h-11 min-w-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong"
        >
          <TokenlyMark />
        </Link>

        <div className="mt-8 rounded-2xl bg-canvas-soft px-4 py-3.5">
          <p className="text-xs font-semibold tracking-[0.1em] text-ink-soft uppercase">
            {roleLabel}
          </p>
          <p className="mt-1 truncate font-semibold text-ink">{accountName}</p>
        </div>

        <nav
          aria-label={`${roleLabel} navigation`}
          className="mt-6 space-y-1.5"
        >
          {navigation.map((item) => (
            <NavigationLink key={item.href} item={item} />
          ))}
        </nav>

        <Link
          href="/help"
          className="mt-auto flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-canvas-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong"
        >
          <CircleHelp aria-hidden="true" className="size-5" />
          Help
        </Link>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-ink/5 bg-canvas/88 backdrop-blur-xl">
          <div className="mx-auto flex min-h-18 w-full max-w-[90rem] items-center gap-4 px-4 sm:px-6 lg:min-h-20 lg:px-8">
            <Link
              href={homeHref}
              aria-label={`${roleLabel} home`}
              className="inline-flex min-h-11 min-w-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-blue-strong lg:hidden"
            >
              <TokenlyMark compact />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase lg:hidden">
                {roleLabel}
              </p>
              <h1 className="truncate text-lg font-bold tracking-[-0.02em] text-ink sm:text-xl">
                {pageTitle ?? accountName}
              </h1>
            </div>
            {actions}
            <details className="group relative shrink-0 lg:hidden">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-white text-ink shadow-soft ring-1 ring-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-strong [&::-webkit-details-marker]:hidden">
                <Menu aria-hidden="true" className="size-5" />
                <span className="sr-only">Navigation menu</span>
              </summary>
              <nav
                aria-label={`${roleLabel} menu`}
                className="absolute top-14 right-0 z-50 max-h-[min(70vh,32rem)] w-[min(18rem,calc(100vw-2rem))] space-y-1 overflow-y-auto overscroll-contain rounded-card bg-white p-3 shadow-floating ring-1 ring-ink/6"
              >
                <div className="mb-2 px-3 py-2">
                  <p className="text-xs font-semibold tracking-[0.08em] text-ink-soft uppercase">
                    {roleLabel}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">
                    {accountName}
                  </p>
                </div>
                {navigation.map((item) => (
                  <NavigationLink key={item.href} item={item} />
                ))}
              </nav>
            </details>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[90rem] px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10 lg:pb-12">
          {children}
        </main>
      </div>

      <nav
        aria-label={`${roleLabel} mobile navigation`}
        className="tokenly-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink/5 bg-white/94 px-2 pt-2 shadow-[0_-12px_30px_rgb(23_36_59/0.08)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch gap-1">
          {mobileNavigation.map((item) => (
            <NavigationLink key={item.href} item={item} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}
