"use client";

import { Database, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  {
    href: "/dev/role-switcher",
    label: "Role switcher",
    icon: UserRoundCog,
  },
  {
    href: "/dev/data",
    label: "Local data",
    icon: Database,
  },
] as const;

function isCurrentLocation(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DevelopmentToolsNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Development tools"
      className="flex gap-2 overflow-x-auto rounded-card bg-white p-2 shadow-soft lg:sticky lg:top-6 lg:block lg:self-start"
    >
      {navigationItems.map(({ href, label, icon: Icon }) => {
        const isCurrent = isCurrentLocation(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isCurrent ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:flex ${
              isCurrent
                ? "bg-brand-blue-soft text-brand-blue-strong"
                : "text-ink-muted hover:bg-canvas-soft hover:text-ink"
            }`}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
