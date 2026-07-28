"use client";

import { House, ListChecks, LogOut, QrCode } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { clearPrototypeSession } from "@/config/remote-customer-access-client";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import { decideRoleAccess } from "@/modules/authentication";
import { DashboardShell } from "@/shared/components/dashboard-shell";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const accessDecision =
    runtime.status === "ready"
      ? decideRoleAccess(runtime.session, ["administrator"])
      : null;

  useEffect(() => {
    if (accessDecision?.status === "redirect") {
      router.replace(accessDecision.destination);
    }
  }, [accessDecision, router]);

  if (runtime.status === "loading" || accessDecision === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 shadow-soft"
        >
          Opening admin...
        </p>
      </main>
    );
  }

  if (runtime.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p role="alert" className="rounded-card bg-white p-6 shadow-soft">
          Tokenly local admin data is unavailable.
        </p>
      </main>
    );
  }

  if (accessDecision.status !== "allowed") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 shadow-soft"
        >
          Redirecting...
        </p>
      </main>
    );
  }

  function signOut(): void {
    runtime.signOut();
    void clearPrototypeSession();
    router.replace("/enter");
  }

  return (
    <DashboardShell
      navigation={[
        {
          href: "/admin",
          label: "Overview",
          icon: <House />,
          isActive: pathname === "/admin" || pathname === "/admin/dashboard",
        },
        {
          href: "/admin/tokeners",
          label: "Tokeners",
          icon: <QrCode />,
          isActive: pathname.startsWith("/admin/tokeners"),
        },
        {
          href: "/admin/transactions",
          label: "Activity",
          icon: <ListChecks />,
          isActive: pathname.startsWith("/admin/transactions"),
        },
      ]}
      roleLabel="Super-admin"
      accountName={accessDecision.session.account.displayName}
      homeHref="/admin"
      pageTitle={pathname.startsWith("/admin/tokeners") ? "Tokeners" : "Admin"}
      actions={
        <button
          type="button"
          onClick={signOut}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink-muted shadow-soft ring-1 ring-ink/5"
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
          <span className="sr-only sm:hidden">Sign out</span>
        </button>
      }
    >
      {children}
    </DashboardShell>
  );
}
