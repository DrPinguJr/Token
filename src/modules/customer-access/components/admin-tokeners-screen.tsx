"use client";

import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePlus,
  History,
  PlusCircle,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { generateRouteQrCodeDataUrl } from "@/config/qr-code-image-generator";

import type {
  AdminTokenerAccessSummary,
  AdminTokenerTransactionItem,
} from "../customer-access-read-model";
import {
  AdminAddCreditsDialog,
  type AddCreditsInput,
} from "./admin-add-credits-dialog";

export interface AdminTokenersScreenProps {
  readonly addTokenerCredits?: (input: AddCreditsInput) => Promise<void>;
  readonly createTokener?: (input: {
    readonly displayName: string;
    readonly mobileNumber: string;
  }) => Promise<void>;
  readonly loadTokeners: () => Promise<readonly AdminTokenerAccessSummary[]>;
  readonly loadTokenerDetail?: (
    customerId: string,
  ) => Promise<AdminTokenerAccessSummary>;
  readonly refreshClaimQr?: (customerId: string) => Promise<void>;
  readonly refundTokenerTransaction?: (input: {
    readonly customerId: string;
    readonly purchaseTransactionGroupId: string;
    readonly reason: string;
    readonly tokenAmount: number;
  }) => Promise<AdminTokenerAccessSummary>;
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

function formatTokenAmount(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseRefundTokenAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [wholeValue, fractionalValue = ""] = trimmed.split(".");
  const cents =
    Number(wholeValue) * 100 + Number(fractionalValue.padEnd(2, "0"));

  return Number.isSafeInteger(cents) && cents > 0 ? cents / 100 : null;
}

function getRefundErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "TOKENLY_API_ERROR";

  switch (code) {
    case "TOKEN_REFUND_AMOUNT_EXCEEDS_REMAINING":
      return "That refund is more than the remaining refundable tokens.";
    case "TOKEN_REFUND_INSUFFICIENT_VENDOR_BALANCE":
      return "The vendor wallet does not have enough tokens for this refund.";
    case "TOKEN_REFUND_PURCHASE_NOT_FOUND":
      return "That vendor charge is no longer refundable.";
    case "PROTOTYPE_SESSION_ROLE_UNAVAILABLE":
      return "Your admin session expired. Sign in again, then retry.";
    default:
      return "Refund could not be recorded.";
  }
}

function TokenerTransactionRow({
  onRefund,
  transaction,
}: Readonly<{
  onRefund: (transaction: AdminTokenerTransactionItem) => void;
  transaction: AdminTokenerTransactionItem;
}>) {
  const isCredit = transaction.direction === "credit";
  const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;
  const canRefund =
    transaction.entryType === "customer_purchase" &&
    transaction.direction === "debit" &&
    transaction.refundableTokenAmount > 0;

  return (
    <li className="grid gap-3 rounded-3xl bg-canvas p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span
        className={`grid size-11 place-items-center rounded-2xl ${
          isCredit
            ? "bg-brand-mint-soft text-brand-mint-strong"
            : "bg-brand-blue-soft text-brand-blue-strong"
        }`}
      >
        <DirectionIcon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-ink">{transaction.title}</p>
          {transaction.vendorName !== null && (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink-muted">
              {transaction.vendorName}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {formatOccurredAt(transaction.occurredAt)}
        </p>
        <p className="mt-1 font-mono text-xs break-all text-ink-muted">
          {transaction.reference}
        </p>
        {canRefund && (
          <p className="mt-2 text-xs font-bold text-brand-pink-strong">
            {formatTokenAmount(transaction.refundableTokenAmount)} refundable
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <p
          className={`font-bold whitespace-nowrap tabular-nums ${
            isCredit ? "text-success" : "text-ink"
          }`}
        >
          {isCredit ? "+" : "-"}
          {formatTokenAmount(transaction.tokenAmount)}
        </p>
        {canRefund && (
          <button
            type="button"
            onClick={() => onRefund(transaction)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-pink-soft px-4 py-2 text-sm font-bold text-brand-pink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Refund
          </button>
        )}
      </div>
    </li>
  );
}

function TokenerDetailDialog({
  addTokenerCredits,
  detailLoadError,
  isLoadingDetail,
  onClose,
  onRefreshClaimQr,
  onReload,
  onTokenerUpdated,
  refundTokenerTransaction,
  selectedTokener,
}: Readonly<{
  addTokenerCredits?: AdminTokenersScreenProps["addTokenerCredits"];
  detailLoadError: string | null;
  isLoadingDetail: boolean;
  onClose: () => void;
  onRefreshClaimQr?: (customerId: string) => Promise<void>;
  onReload: () => void;
  onTokenerUpdated: (tokener: AdminTokenerAccessSummary) => void;
  refundTokenerTransaction?: AdminTokenersScreenProps["refundTokenerTransaction"];
  selectedTokener: AdminTokenerAccessSummary;
}>) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creditsDialogIsOpen, setCreditsDialogIsOpen] = useState(false);
  const [creditsMessage, setCreditsMessage] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] =
    useState<AdminTokenerTransactionItem | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundMessage, setRefundMessage] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const parsedRefundAmount = parseRefundTokenAmount(refundAmount);

  useEffect(() => {
    let active = true;

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

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creditsDialogIsOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [creditsDialogIsOpen, onClose]);

  async function refreshClaimQr(): Promise<void> {
    if (onRefreshClaimQr === undefined) {
      return;
    }

    setIsRefreshing(true);
    try {
      await onRefreshClaimQr(selectedTokener.customerId);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (refundTarget === null || refundTokenerTransaction === undefined) {
      return;
    }

    if (parsedRefundAmount === null) {
      setRefundError("Enter a refund amount.");
      return;
    }

    if (parsedRefundAmount > refundTarget.refundableTokenAmount) {
      setRefundError("Refund cannot exceed the remaining refundable tokens.");
      return;
    }

    const reason = refundReason.trim();
    if (reason.length === 0) {
      setRefundError("Enter a refund reason.");
      return;
    }

    setIsRefunding(true);
    setRefundError(null);
    setRefundMessage(null);

    try {
      const updatedTokener = await refundTokenerTransaction({
        customerId: selectedTokener.customerId,
        purchaseTransactionGroupId: refundTarget.transactionGroupId,
        reason,
        tokenAmount: parsedRefundAmount,
      });
      onTokenerUpdated(updatedTokener);
      setRefundTarget(null);
      setRefundAmount("");
      setRefundReason("");
      setRefundMessage(
        "Refund recorded. Customer and vendor histories updated.",
      );
    } catch (error: unknown) {
      setRefundError(getRefundErrorMessage(error));
    } finally {
      setIsRefunding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid items-end bg-ink/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tokener-detail-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-floating sm:max-w-5xl sm:rounded-card sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-[0.14em] text-brand-pink-strong uppercase">
              Tokener
            </p>
            <h2
              id="tokener-detail-title"
              className="mt-1 text-3xl font-bold text-ink"
            >
              {selectedTokener.displayName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-ink-muted">
              {formatTokenAmount(selectedTokener.balance)} tokens
            </p>
            {selectedTokener.mobileNumber !== null && (
              <p className="mt-1 font-mono text-sm text-ink-muted">
                {selectedTokener.mobileNumber}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close tokener"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full bg-canvas text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <section className="rounded-3xl bg-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-ink">Claim QR</h3>
                <span className="rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-bold text-brand-blue-strong">
                  {formatClaimState(selectedTokener)}
                </span>
              </div>
              <div className="mt-4 rounded-[2rem] border border-ink/10 bg-white p-4 text-center shadow-soft">
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
                    className="mx-auto size-56"
                  />
                )}
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-muted">
                The QR opens the tokener private account link. Raw claim and
                private link values are hidden from this view.
              </p>
              {onRefreshClaimQr !== undefined && (
                <button
                  type="button"
                  disabled={isRefreshing}
                  onClick={() => void refreshClaimQr()}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-wait disabled:bg-ink-muted"
                >
                  <RefreshCw aria-hidden="true" className="size-5" />
                  {isRefreshing ? "Refreshing..." : "Refresh claim QR"}
                </button>
              )}
            </section>

            {addTokenerCredits !== undefined && (
              <section className="rounded-3xl bg-brand-mint-soft p-4">
                <h3 className="font-bold text-ink">Wallet credits</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">
                  Record payment evidence before issuing credits.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreditsMessage(null);
                    setCreditsDialogIsOpen(true);
                  }}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-mint-strong px-5 py-3 font-semibold text-white shadow-raised"
                >
                  <PlusCircle aria-hidden="true" className="size-5" />
                  Add credits
                </button>
                {creditsMessage !== null && (
                  <p
                    role="status"
                    className="mt-3 text-sm font-medium text-brand-mint-strong"
                  >
                    {creditsMessage}
                  </p>
                )}
              </section>
            )}
          </div>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
                <History aria-hidden="true" className="size-5" />
                Transaction history
              </h3>
            </div>

            {refundMessage !== null && (
              <p
                role="status"
                className="mt-4 rounded-2xl bg-brand-mint-soft px-4 py-3 text-sm font-bold text-brand-mint-strong"
              >
                {refundMessage}
              </p>
            )}

            {isLoadingDetail ? (
              <p
                role="status"
                className="mt-4 rounded-3xl bg-canvas p-6 text-center text-sm font-semibold text-ink-muted"
              >
                Loading transaction history...
              </p>
            ) : detailLoadError !== null ? (
              <p
                role="alert"
                className="mt-4 rounded-3xl bg-brand-pink-soft p-6 text-center text-sm font-bold text-danger"
              >
                Transaction history could not load.
              </p>
            ) : selectedTokener.transactions.length === 0 ? (
              <div className="mt-4 rounded-3xl bg-canvas p-6 text-center">
                <p className="font-semibold text-ink">No wallet activity yet</p>
              </div>
            ) : (
              <ol className="mt-4 grid gap-3">
                {selectedTokener.transactions.map((transaction) => (
                  <TokenerTransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onRefund={(nextTarget) => {
                      setRefundTarget(nextTarget);
                      setRefundAmount(String(nextTarget.refundableTokenAmount));
                      setRefundReason("");
                      setRefundError(null);
                      setRefundMessage(null);
                    }}
                  />
                ))}
              </ol>
            )}

            {refundTarget !== null && (
              <form
                className="mt-4 rounded-3xl bg-brand-pink-soft p-4"
                onSubmit={(event) => void submitRefund(event)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-bold text-ink">Refund transaction</h4>
                    <p className="mt-1 text-sm text-ink-muted">
                      {refundTarget.vendorName ?? "Vendor transaction"} -{" "}
                      {formatTokenAmount(refundTarget.refundableTokenAmount)}{" "}
                      remaining
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRefundAmount(
                        String(refundTarget.refundableTokenAmount),
                      );
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-pink-strong"
                  >
                    Full remaining
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <label>
                    <span className="text-sm font-semibold text-ink">
                      Tokens
                    </span>
                    <input
                      inputMode="decimal"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      placeholder="0.00"
                      className="mt-2 min-h-12 w-full rounded-2xl bg-white px-4 py-3 font-bold text-ink tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-semibold text-ink">
                      Reason
                    </span>
                    <input
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      placeholder="Overcharged by 4 tokens"
                      className="mt-2 min-h-12 w-full rounded-2xl bg-white px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </label>
                </div>
                {refundError !== null && (
                  <p
                    role="alert"
                    className="mt-3 text-sm font-bold text-danger"
                  >
                    {refundError}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRefundTarget(null);
                      setRefundError(null);
                    }}
                    className="min-h-12 rounded-full bg-white px-5 py-3 font-bold text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRefunding}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger px-5 py-3 font-bold text-white shadow-raised disabled:cursor-wait disabled:bg-ink-muted"
                  >
                    <RotateCcw aria-hidden="true" className="size-5" />
                    {isRefunding ? "Saving..." : "Record refund"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        {creditsDialogIsOpen && addTokenerCredits !== undefined && (
          <AdminAddCreditsDialog
            customerId={selectedTokener.customerId}
            customerName={selectedTokener.displayName}
            submitCredits={addTokenerCredits}
            onClose={() => setCreditsDialogIsOpen(false)}
            onComplete={() => {
              setCreditsDialogIsOpen(false);
              setCreditsMessage("Credits issued and audit evidence recorded.");
              onReload();
            }}
          />
        )}
      </section>
    </div>
  );
}

export function AdminTokenersScreen({
  addTokenerCredits,
  createTokener,
  loadTokenerDetail,
  loadTokeners,
  refreshClaimQr,
  refundTokenerTransaction,
  selectedCustomerId,
}: AdminTokenersScreenProps) {
  const [tokeners, setTokeners] = useState<
    readonly AdminTokenerAccessSummary[] | null
  >(null);
  const [hasError, setHasError] = useState(false);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedCustomerId ?? null,
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [loadedListVersion, setLoadedListVersion] = useState(-1);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newMobileNumber, setNewMobileNumber] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        setHasError(false);
        setLoadErrorCode(null);
      }
    });
    void loadTokeners()
      .then((loadedTokeners) => {
        if (active) {
          setTokeners(loadedTokeners);
          setSelectedId((current) => {
            const requestedId = current ?? selectedCustomerId ?? null;
            return requestedId !== null &&
              loadedTokeners.some(
                (tokener) => tokener.customerId === requestedId,
              )
              ? requestedId
              : null;
          });
          setLoadedListVersion(reloadVersion);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHasError(true);
          setLoadErrorCode(
            error instanceof Error ? error.message : "TOKENLY_API_ERROR",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [loadTokeners, reloadVersion, selectedCustomerId]);

  const tokenersAreLoaded = tokeners !== null;

  useEffect(() => {
    let active = true;

    if (
      selectedId === null ||
      loadTokenerDetail === undefined ||
      !tokenersAreLoaded
    ) {
      void Promise.resolve().then(() => {
        if (active) {
          setIsLoadingDetail(false);
          setDetailLoadError(null);
        }
      });

      return () => {
        active = false;
      };
    }

    void Promise.resolve().then(() => {
      if (active) {
        setIsLoadingDetail(true);
        setDetailLoadError(null);
      }
    });
    void loadTokenerDetail(selectedId)
      .then((tokenerDetail) => {
        if (active) {
          setTokeners(
            (current) =>
              current?.map((tokener) =>
                tokener.customerId === tokenerDetail.customerId
                  ? tokenerDetail
                  : tokener,
              ) ?? null,
          );
        }
      })
      .catch(() => {
        if (active) {
          setDetailLoadError("TOKENLY_API_ERROR");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      active = false;
    };
  }, [loadTokenerDetail, loadedListVersion, selectedId, tokenersAreLoaded]);

  const visibleTokeners = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("en-SG");

    if (tokeners === null || normalizedSearch.length === 0) {
      return tokeners ?? [];
    }

    return tokeners.filter(
      (tokener) =>
        tokener.displayName
          .toLocaleLowerCase("en-SG")
          .includes(normalizedSearch) ||
        tokener.mobileNumber?.includes(normalizedSearch) === true,
    );
  }, [search, tokeners]);
  const selectedTokener =
    tokeners?.find((tokener) => tokener.customerId === selectedId) ?? null;

  if (hasError) {
    return (
      <section className="rounded-card bg-white p-6 text-center shadow-soft">
        <h1 className="text-2xl font-bold text-ink">Tokeners could not load</h1>
        <p role="alert" className="mt-3 text-ink-muted">
          {loadErrorCode === "SUPABASE_SERVER_CONFIGURATION_ERROR"
            ? "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local, then restart the development server."
            : loadErrorCode === "PROTOTYPE_SESSION_ROLE_UNAVAILABLE"
              ? "Your hosted admin session is missing or expired. Sign out, then sign in with an administrator account again."
              : "Supabase tokener records are unavailable. Check the server connection and try again."}
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

  async function submitNewTokener(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (createTokener === undefined) {
      return;
    }

    setCreateMessage(null);
    setIsCreating(true);

    try {
      await createTokener({
        displayName: newDisplayName,
        mobileNumber: newMobileNumber,
      });
      setNewDisplayName("");
      setNewMobileNumber("");
      setCreateMessage("Tokener created. Open their popup to show the QR.");
      setReloadVersion((current) => current + 1);
    } catch {
      setCreateMessage(
        "Tokener could not be created. Check the name and mobile number.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div>
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

        {createTokener !== undefined && (
          <form
            className="mt-6 rounded-card bg-white p-5 shadow-soft"
            onSubmit={(event) => void submitNewTokener(event)}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong">
                <BadgePlus aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">Add tokener</h2>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  Create a QR-only account with a fresh one-time claim code.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-ink">Name</span>
                <input
                  value={newDisplayName}
                  onChange={(event) => setNewDisplayName(event.target.value)}
                  placeholder="Lance Tan"
                  className="mt-2 min-h-12 w-full rounded-2xl bg-canvas px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-ink">
                  Mobile number
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={newMobileNumber}
                  onChange={(event) => setNewMobileNumber(event.target.value)}
                  placeholder="9123 4567"
                  className="mt-2 min-h-12 w-full rounded-2xl bg-canvas px-4 py-3 font-mono text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="mt-4 min-h-12 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised disabled:cursor-wait disabled:bg-ink-muted"
            >
              {isCreating ? "Creating..." : "Create tokener"}
            </button>
            {createMessage !== null && (
              <p
                role="status"
                className="mt-3 text-sm font-medium text-ink-muted"
              >
                {createMessage}
              </p>
            )}
          </form>
        )}

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
                    {tokener.mobileNumber !== null && (
                      <p className="mt-1 font-mono text-sm text-ink-muted">
                        {tokener.mobileNumber}
                      </p>
                    )}
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
                      Claim QR
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-ink-muted ring-1 ring-ink/6">
                      <History aria-hidden="true" className="size-4" />
                      History
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

      {selectedTokener !== null && (
        <TokenerDetailDialog
          addTokenerCredits={addTokenerCredits}
          detailLoadError={detailLoadError}
          isLoadingDetail={isLoadingDetail}
          refundTokenerTransaction={refundTokenerTransaction}
          selectedTokener={selectedTokener}
          onClose={() => setSelectedId(null)}
          onRefreshClaimQr={refreshSelectedClaimQr}
          onReload={() => setReloadVersion((current) => current + 1)}
          onTokenerUpdated={(updatedTokener) => {
            setTokeners(
              (current) =>
                current?.map((tokener) =>
                  tokener.customerId === updatedTokener.customerId
                    ? updatedTokener
                    : tokener,
                ) ?? null,
            );
          }}
        />
      )}
    </div>
  );
}
