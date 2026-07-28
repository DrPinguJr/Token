"use client";

import Image from "next/image";
import Link from "next/link";
import { QrCode, RefreshCw, Search, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { generateRouteQrCodeDataUrl } from "@/config/qr-code-image-generator";

import type { AdminTokenerAccessSummary } from "../customer-access-read-model";

export interface AdminTokenersScreenProps {
  readonly loadTokeners: () => Promise<readonly AdminTokenerAccessSummary[]>;
  readonly refreshClaimQr?: (customerId: string) => Promise<void>;
  readonly selectedCustomerId?: string;
}

function formatClaimState(tokener: AdminTokenerAccessSummary): string {
  if (tokener.claimedAt !== null) {
    return "Claimed";
  }

  if (Date.parse(tokener.claimExpiresAt) <= Date.now()) {
    return "Expired";
  }

  return "Ready to claim";
}

function ClaimQrPanel({
  selectedTokener,
  onRefreshClaimQr,
}: Readonly<{
  selectedTokener: AdminTokenerAccessSummary | null;
  onRefreshClaimQr?: (customerId: string) => Promise<void>;
}>) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    if (selectedTokener === null) {
      void Promise.resolve().then(() => {
        if (active) {
          setImageDataUrl(null);
        }
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (active) {
        setImageDataUrl(null);
      }
    });
    void generateRouteQrCodeDataUrl(selectedTokener.claimPath).then((url) => {
      if (active) {
        setImageDataUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedTokener]);

  if (selectedTokener === null) {
    return (
      <aside className="rounded-card bg-white p-6 shadow-soft">
        <h2 className="text-xl font-bold text-ink">Claim QR</h2>
        <p className="mt-3 leading-7 text-ink-muted">
          Select a tokener to open their one-time claim QR code.
        </p>
      </aside>
    );
  }

  async function refreshClaimQr(): Promise<void> {
    const tokener = selectedTokener;
    if (onRefreshClaimQr === undefined || tokener === null) {
      return;
    }

    setIsRefreshing(true);
    try {
      await onRefreshClaimQr(tokener.customerId);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <aside className="sticky top-24 rounded-card bg-white p-6 shadow-raised">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-[0.14em] text-brand-pink-strong uppercase">
            One-time claim
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">
            {selectedTokener.displayName}
          </h2>
        </div>
        <span className="rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-bold text-brand-blue-strong">
          {formatClaimState(selectedTokener)}
        </span>
      </div>

      <div className="mt-5 rounded-[2rem] border border-ink/10 bg-white p-4 text-center shadow-soft">
        {imageDataUrl === null ? (
          <p role="status" className="p-10 text-sm text-ink-muted">
            Preparing QR...
          </p>
        ) : (
          <Image
            unoptimized
            src={imageDataUrl}
            alt={`${selectedTokener.displayName} one-time claim QR`}
            width={320}
            height={320}
            className="mx-auto size-64"
          />
        )}
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-ink">Claim link</dt>
          <dd className="mt-1 font-mono break-all text-ink-muted">
            {selectedTokener.claimPath}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Private account link</dt>
          <dd className="mt-1 font-mono break-all text-ink-muted">
            {selectedTokener.privateAccountPath}
          </dd>
        </div>
      </dl>

      <p className="mt-5 rounded-2xl bg-canvas-soft p-4 text-sm leading-6 text-ink-muted">
        This QR gives the tokener their private account link. It is separate
        from the wallet QR used by vendors.
      </p>

      {onRefreshClaimQr !== undefined && (
        <button
          type="button"
          disabled={isRefreshing}
          onClick={() => void refreshClaimQr()}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-wait disabled:bg-ink-muted"
        >
          <RefreshCw aria-hidden="true" className="size-5" />
          {isRefreshing ? "Refreshing..." : "Refresh 15-minute claim QR"}
        </button>
      )}
    </aside>
  );
}

export function AdminTokenersScreen({
  loadTokeners,
  refreshClaimQr,
  selectedCustomerId,
}: AdminTokenersScreenProps) {
  const [tokeners, setTokeners] = useState<
    readonly AdminTokenerAccessSummary[] | null
  >(null);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedCustomerId ?? null,
  );
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        setHasError(false);
        setTokeners(null);
      }
    });
    void loadTokeners()
      .then((loadedTokeners) => {
        if (active) {
          setTokeners(loadedTokeners);
          setSelectedId(
            (current) => current ?? loadedTokeners[0]?.customerId ?? null,
          );
        }
      })
      .catch(() => {
        if (active) {
          setHasError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [loadTokeners, reloadVersion]);

  const visibleTokeners = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("en-SG");

    if (tokeners === null || normalizedSearch.length === 0) {
      return tokeners ?? [];
    }

    return tokeners.filter((tokener) =>
      tokener.displayName.toLocaleLowerCase("en-SG").includes(normalizedSearch),
    );
  }, [search, tokeners]);
  const selectedTokener =
    tokeners?.find((tokener) => tokener.customerId === selectedId) ?? null;

  if (hasError) {
    return (
      <section className="rounded-card bg-white p-6 text-center shadow-soft">
        <h1 className="text-2xl font-bold text-ink">Tokeners could not load</h1>
        <p role="alert" className="mt-3 text-ink-muted">
          Local prototype tokener records are unavailable.
        </p>
        <button
          type="button"
          onClick={() => setReloadVersion((current) => current + 1)}
          className="mt-5 min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white"
        >
          Try again
        </button>
      </section>
    );
  }

  if (tokeners === null) {
    return (
      <p role="status" className="rounded-full bg-white px-5 py-3 shadow-soft">
        Loading tokeners...
      </p>
    );
  }

  async function refreshSelectedClaimQr(customerId: string): Promise<void> {
    if (refreshClaimQr === undefined) {
      return;
    }

    await refreshClaimQr(customerId);
    setReloadVersion((current) => current + 1);
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-7">
      <section aria-labelledby="tokeners-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
              Super-admin distribution
            </p>
            <h1
              id="tokeners-heading"
              className="mt-1 text-3xl font-bold text-ink"
            >
              Tokeners
            </h1>
            <p className="mt-2 max-w-2xl leading-7 text-ink-muted">
              Open a one-time claim QR for a tokener, then they can keep their
              private account link without signing up.
            </p>
          </div>
          <label className="block w-full sm:max-w-xs">
            <span className="mb-2 block text-sm font-semibold text-ink">
              Search tokeners
            </span>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Try Lance"
                className="min-h-12 w-full rounded-full bg-white py-3 pr-4 pl-12 text-ink shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
            </span>
          </label>
        </div>

        <ul className="mt-6 grid gap-4">
          {visibleTokeners.map((tokener) => (
            <li key={tokener.customerId}>
              <button
                type="button"
                onClick={() => setSelectedId(tokener.customerId)}
                className={`w-full rounded-card bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus ${
                  selectedId === tokener.customerId
                    ? "ring-2 ring-brand-blue-strong"
                    : ""
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-ink">
                      {tokener.displayName}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      Claim: {formatClaimState(tokener)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-mint-soft px-3 py-1 font-bold text-brand-mint-strong">
                      <WalletCards aria-hidden="true" className="size-4" />
                      {tokener.balance} tokens
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-blue-soft px-3 py-1 font-bold text-brand-blue-strong">
                      <QrCode aria-hidden="true" className="size-4" />
                      wallet {tokener.walletPublicCode}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {visibleTokeners.length === 0 && (
          <div className="mt-6 rounded-card bg-white p-6 text-center shadow-soft">
            <p className="font-semibold text-ink">No matching tokeners</p>
          </div>
        )}
      </section>

      <div className="mt-7 lg:mt-0">
        <ClaimQrPanel
          selectedTokener={selectedTokener}
          onRefreshClaimQr={refreshSelectedClaimQr}
        />
        {selectedTokener !== null && (
          <Link
            href={`/admin/tokeners/${selectedTokener.customerId}`}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 py-3 font-semibold text-ink shadow-soft ring-1 ring-ink/5"
          >
            Open tokener detail
          </Link>
        )}
      </div>
    </div>
  );
}
