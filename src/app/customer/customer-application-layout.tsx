"use client";

import {
  House,
  ListOrdered,
  LogOut,
  ScanLine,
  Store,
  WalletCards,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import { decideRoleAccess } from "@/modules/authentication";
import {
  DashboardShell,
  type ShellNavigationItem,
} from "@/shared/components/dashboard-shell";

function getCustomerPageTitle(pathname: string): string {
  if (pathname === "/customer") {
    return "Home";
  }

  if (pathname.startsWith("/customer/wallet")) {
    return pathname.startsWith("/customer/wallet/qr")
      ? "My customer QR"
      : "Wallet";
  }

  if (pathname.startsWith("/customer/transactions/")) {
    return "Transaction details";
  }

  if (pathname.startsWith("/customer/transactions")) {
    return "Activity";
  }

  if (pathname.startsWith("/customer/scan")) {
    return "Scan to pay";
  }

  if (pathname.startsWith("/customer/pay")) {
    return "Review purchase";
  }

  if (pathname.startsWith("/customer/vendors/")) {
    return "Vendor";
  }

  if (pathname.startsWith("/customer/vendors")) {
    return "Vendors";
  }

  return "Tokenly";
}

function createNavigation(pathname: string): readonly ShellNavigationItem[] {
  return [
    {
      href: "/customer",
      label: "Home",
      icon: <House />,
      isActive: pathname === "/customer",
    },
    {
      href: "/customer/wallet",
      label: "Wallet",
      icon: <WalletCards />,
      isActive: pathname.startsWith("/customer/wallet"),
    },
    {
      href: "/customer/scan",
      label: "Scan",
      icon: <ScanLine />,
      isActive: pathname.startsWith("/customer/scan"),
    },
    {
      href: "/customer/vendors",
      label: "Vendors",
      icon: <Store />,
      isActive:
        pathname.startsWith("/customer/vendors") ||
        pathname.startsWith("/customer/pay"),
    },
    {
      href: "/customer/transactions",
      label: "Activity",
      icon: <ListOrdered />,
      isActive: pathname.startsWith("/customer/transactions"),
    },
  ];
}

export function CustomerApplicationLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const runtime = useTokenlyRuntime();
  const [retryFailed, setRetryFailed] = useState(false);
  const isOnboardingRoute = pathname.startsWith("/customer/onboarding");
  const accessDecision =
    runtime.status === "ready"
      ? decideRoleAccess(runtime.session, ["customer"])
      : null;
  const allowedSession =
    accessDecision?.status === "allowed" ? accessDecision.session : null;
  const redirectDestination =
    accessDecision?.status === "redirect"
      ? accessDecision.destination
      : allowedSession?.customer?.onboardingCompletedAt === null
        ? "/customer/onboarding"
        : null;

  useEffect(() => {
    if (!isOnboardingRoute && redirectDestination !== null) {
      router.replace(redirectDestination);
    }
  }, [isOnboardingRoute, redirectDestination, router]);

  if (isOnboardingRoute) {
    return children;
  }

  async function retryRuntime(): Promise<void> {
    setRetryFailed(false);

    try {
      await runtime.reloadRuntime();
    } catch {
      setRetryFailed(true);
    }
  }

  function signOut(): void {
    runtime.signOut();
    router.replace("/enter");
  }

  if (runtime.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-card bg-white p-6 text-center shadow-soft">
          <h1 className="text-2xl font-bold text-ink">
            Your customer wallet could not open
          </h1>
          <p role="alert" className="mt-3 leading-7 text-ink-muted">
            Tokenly local data is unavailable. Try opening it again.
          </p>
          {retryFailed && (
            <p
              role="alert"
              className="mt-3 rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-medium text-danger"
            >
              Tokenly still could not open. Your local data was not changed.
            </p>
          )}
          <button
            type="button"
            onClick={() => void retryRuntime()}
            className="mt-5 min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (
    runtime.status === "loading" ||
    accessDecision === null ||
    redirectDestination !== null
  ) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 font-medium text-ink-muted shadow-soft"
        >
          Opening your wallet…
        </p>
      </main>
    );
  }

  if (
    accessDecision.status !== "allowed" ||
    accessDecision.session.customer === null
  ) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="alert"
          className="rounded-card bg-brand-pink-soft p-6 font-medium text-danger shadow-soft"
        >
          The customer profile required for this wallet is unavailable.
        </p>
      </main>
    );
  }

  return (
    <DashboardShell
      navigation={createNavigation(pathname)}
      roleLabel="Customer"
      accountName={accessDecision.session.account.displayName}
      homeHref="/customer"
      pageTitle={getCustomerPageTitle(pathname)}
      actions={
        <button
          type="button"
          onClick={signOut}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink-muted shadow-soft ring-1 ring-ink/5 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
