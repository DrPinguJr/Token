"use client";

import {
  Download,
  Eye,
  FileImage,
  Gamepad2,
  History,
  RefreshCw,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Store,
  Utensils,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  AdminBoothReport,
  AdminBoothSummary,
  AdminBoothTransactionItem,
  AdminCreditIssuanceReportItem,
  AdminTransactionOverview,
} from "../admin-transaction-read-model";

export interface AdminTransactionsScreenProps {
  readonly loadOverview: () => Promise<AdminTransactionOverview>;
}

type ReportTab = "food" | "games" | "issuance" | "vendor1";

function formatEntryType(entryType: string): string {
  return entryType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSgd(cents: number): string {
  return new Intl.NumberFormat("en-SG", {
    currency: "SGD",
    style: "currency",
  }).format(cents / 100);
}

function formatTokenAmount(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function csvCell(value: string | number | null): string {
  const rawValue = value === null ? "" : String(value);
  const safeValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): void {
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const emptyGamesReport: AdminBoothReport = {
  category: "games",
  summaries: [],
  transactions: [],
};

const emptyFoodReport: AdminBoothReport = {
  category: "food",
  summaries: [],
  transactions: [],
};

const emptyVendor1Report: AdminBoothReport = {
  category: "vendor1",
  summaries: [],
  transactions: [],
};

const emptyOverview: AdminTransactionOverview = {
  boothReports: [emptyVendor1Report, emptyGamesReport, emptyFoodReport],
  creditIssuances: [],
  metrics: {
    issuedTokens: 0,
    refundedTokens: 0,
    spentTokens: 0,
    transactionGroups: 0,
  },
  transactions: [],
};

export function AdminTransactionsScreen({
  loadOverview,
}: AdminTransactionsScreenProps) {
  const [overview, setOverview] = useState<AdminTransactionOverview | null>(
    null,
  );
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<ReportTab>("issuance");
  const [gameBoothFilter, setGameBoothFilter] = useState<number | "all">("all");
  const [foodBoothFilter, setFoodBoothFilter] = useState<number | "all">("all");

  useEffect(() => {
    let active = true;

    void Promise.resolve()
      .then(async () => {
        if (!active) {
          return null;
        }

        setErrorCode(null);
        setOverview(null);
        return loadOverview();
      })
      .then((loadedOverview) => {
        if (active && loadedOverview !== null) {
          setOverview(loadedOverview);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setOverview(emptyOverview);
          setErrorCode(
            error instanceof Error ? error.message : "TOKENLY_API_ERROR",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [loadOverview, reloadVersion]);

  const loadedOverview = overview ?? emptyOverview;
  const metrics = loadedOverview.metrics;
  const gamesReport =
    loadedOverview.boothReports.find((report) => report.category === "games") ??
    emptyGamesReport;
  const foodReport =
    loadedOverview.boothReports.find((report) => report.category === "food") ??
    emptyFoodReport;
  const vendor1Report =
    loadedOverview.boothReports.find(
      (report) => report.category === "vendor1",
    ) ?? emptyVendor1Report;

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
          Supabase activity
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Transactions</h1>
        <p className="mt-3 max-w-3xl leading-7 text-ink-muted">
          Ledger activity, manual credit evidence, and booth totals from the
          hosted Tokenly database.
        </p>
      </section>

      <section
        aria-label="Transaction metrics"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <MetricCard
          icon={<History />}
          label="Transaction groups"
          value={metrics.transactionGroups}
        />
        <MetricCard
          icon={<WalletCards />}
          label="Credits issued"
          value={metrics.issuedTokens}
        />
        <MetricCard
          icon={<ShoppingBag />}
          label="Customer spend"
          value={metrics.spentTokens}
        />
        <MetricCard
          icon={<RotateCcw />}
          label="Customer refunds"
          value={metrics.refundedTokens}
        />
      </section>

      {errorCode !== null && (
        <section className="rounded-card border border-brand-pink/50 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-bold text-ink">
            Supabase activity could not load
          </h2>
          <p role="alert" className="mt-2 leading-7 text-ink-muted">
            {errorCode === "SUPABASE_SERVER_CONFIGURATION_ERROR"
              ? "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local, then restart the development server."
              : errorCode === "PROTOTYPE_SESSION_ROLE_UNAVAILABLE"
                ? "Your hosted admin session is missing or expired. Sign out, then sign in with an administrator account again."
                : "The hosted transaction records are temporarily unavailable. The zero metrics above are placeholders, not confirmed database totals."}
          </p>
          <button
            type="button"
            onClick={() => setReloadVersion((current) => current + 1)}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white"
          >
            <RefreshCw aria-hidden="true" className="size-5" />
            Try again
          </button>
        </section>
      )}

      {overview === null && (
        <p
          role="status"
          className="w-fit rounded-full bg-white px-5 py-3 font-medium text-ink-muted shadow-soft"
        >
          Loading Supabase activity...
        </p>
      )}

      {overview !== null && errorCode === null && (
        <section className="space-y-5">
          <div className="flex flex-wrap gap-2 rounded-card bg-white p-2 shadow-soft">
            <ReportTabButton
              active={activeTab === "issuance"}
              icon={<ReceiptText />}
              label="Token issuance"
              onClick={() => setActiveTab("issuance")}
            />
            <ReportTabButton
              active={activeTab === "vendor1"}
              icon={<Store />}
              label="Vendor1"
              onClick={() => setActiveTab("vendor1")}
            />
            <ReportTabButton
              active={activeTab === "games"}
              icon={<Gamepad2 />}
              label="Game booths"
              onClick={() => setActiveTab("games")}
            />
            <ReportTabButton
              active={activeTab === "food"}
              icon={<Utensils />}
              label="Food booths"
              onClick={() => setActiveTab("food")}
            />
          </div>

          {activeTab === "issuance" && (
            <CreditIssuanceReport issuances={loadedOverview.creditIssuances} />
          )}
          {activeTab === "vendor1" && (
            <BoothReportPanel
              filter="all"
              icon={<Store />}
              onFilterChange={() => undefined}
              report={vendor1Report}
              title="Vendor1"
            />
          )}
          {activeTab === "games" && (
            <BoothReportPanel
              filter={gameBoothFilter}
              icon={<Gamepad2 />}
              onFilterChange={setGameBoothFilter}
              report={gamesReport}
              title="Game booths"
            />
          )}
          {activeTab === "food" && (
            <BoothReportPanel
              filter={foodBoothFilter}
              icon={<Utensils />}
              onFilterChange={setFoodBoothFilter}
              report={foodReport}
              title="Food booths"
            />
          )}
        </section>
      )}
    </div>
  );
}

function ReportTabButton({
  active,
  icon,
  label,
  onClick,
}: Readonly<{
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold sm:flex-none ${
        active
          ? "bg-ink text-white"
          : "bg-canvas text-ink hover:bg-brand-blue-soft"
      }`}
    >
      <span className="[&>svg]:size-5">{icon}</span>
      {label}
    </button>
  );
}

function CreditIssuanceReport({
  issuances,
}: Readonly<{
  issuances: readonly AdminCreditIssuanceReportItem[];
}>) {
  const totalTokens = issuances.reduce(
    (total, issuance) => total + issuance.tokenAmount,
    0,
  );
  const totalSgdCents = issuances.reduce(
    (total, issuance) => total + issuance.sgdAmountCents,
    0,
  );

  function exportIssuances(): void {
    downloadCsv(
      "tokenly-token-issuance-report.csv",
      [
        "Created at UTC",
        "Customer name",
        "NRIC",
        "Reference",
        "Payment method",
        "SGD amount",
        "Token amount",
        "Evidence file",
        "Evidence storage path",
        "Transaction group",
      ],
      issuances.map((issuance) => [
        issuance.createdAt,
        issuance.customerName,
        issuance.nric,
        issuance.reference,
        issuance.paymentMethod,
        (issuance.sgdAmountCents / 100).toFixed(2),
        issuance.tokenAmount.toFixed(2),
        issuance.evidenceFileName,
        issuance.evidenceStoragePath,
        issuance.transactionGroupId,
      ]),
    );
  }

  return (
    <section className="overflow-hidden rounded-card bg-white shadow-soft">
      <div className="flex flex-col gap-4 border-b border-ink/6 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-xl font-bold text-ink">Token issuance</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {formatTokenAmount(totalTokens)} tokens from{" "}
            {formatSgd(totalSgdCents)}
          </p>
        </div>
        <button
          type="button"
          onClick={exportIssuances}
          disabled={issuances.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-blue-soft px-4 py-2 font-bold text-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download aria-hidden="true" className="size-4" />
          Export for Sheets
        </button>
      </div>

      {issuances.length === 0 ? (
        <EmptyReport icon={<ReceiptText />} title="No credit issuances yet" />
      ) : (
        <>
          <div className="space-y-3 p-4 sm:hidden">
            {issuances.map((issuance) => (
              <article
                key={issuance.id}
                className="rounded-2xl bg-canvas p-4 ring-1 ring-ink/6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.12em] text-ink-muted uppercase">
                      {formatOccurredAt(issuance.createdAt)}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-ink">
                      {issuance.customerName}
                    </h3>
                    <p className="mt-1 font-mono text-sm text-ink-muted">
                      {issuance.nric ?? "No NRIC"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold whitespace-nowrap text-ink">
                      {formatTokenAmount(issuance.tokenAmount)}
                    </p>
                    <p className="text-xs font-semibold text-ink-muted">
                      tokens
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="font-semibold text-ink-muted">Received</dt>
                    <dd className="mt-1 font-bold text-ink">
                      {formatSgd(issuance.sgdAmountCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-muted">Method</dt>
                    <dd className="mt-1 font-bold text-ink capitalize">
                      {issuance.paymentMethod}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 font-mono text-xs break-all text-ink-muted">
                  {issuance.reference}
                </p>
                <EvidencePreviewLink issuance={issuance} />
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[58rem] text-left text-sm">
              <thead className="bg-canvas text-xs font-bold tracking-[0.12em] text-ink-muted uppercase">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">NRIC</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/6">
                {issuances.map((issuance) => (
                  <tr key={issuance.id}>
                    <td className="px-5 py-4 align-top text-ink-muted">
                      {formatOccurredAt(issuance.createdAt)}
                      <span className="mt-1 block font-mono text-xs">
                        {issuance.reference}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top font-semibold text-ink">
                      {issuance.customerName}
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-ink">
                      {issuance.nric ?? "-"}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className="block font-bold text-ink">
                        {formatTokenAmount(issuance.tokenAmount)} tokens
                      </span>
                      <span className="mt-1 block text-xs text-ink-muted">
                        {formatSgd(issuance.sgdAmountCents)} -{" "}
                        {issuance.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <EvidencePreviewLink issuance={issuance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function EvidencePreviewLink({
  issuance,
}: Readonly<{
  issuance: AdminCreditIssuanceReportItem;
}>) {
  if (issuance.evidencePreviewUrl === null) {
    return (
      <span className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-ink-muted ring-1 ring-ink/6 sm:mt-0 sm:bg-canvas sm:ring-0">
        <FileImage aria-hidden="true" className="size-4" />
        Preview unavailable
      </span>
    );
  }

  return (
    <a
      href={issuance.evidencePreviewUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-4 inline-flex w-full items-center gap-3 rounded-2xl bg-white p-2 pr-3 font-bold text-ink ring-1 ring-ink/6 hover:bg-brand-blue-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:mt-0 sm:w-auto sm:bg-canvas sm:ring-0"
    >
      {/* Signed storage URL preview only; image bytes stay in Supabase Storage. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={issuance.evidencePreviewUrl}
        alt=""
        className="size-16 rounded-xl object-cover sm:size-14"
      />
      <span className="inline-flex items-center gap-1">
        <Eye aria-hidden="true" className="size-4" />
        Preview evidence
      </span>
    </a>
  );
}

function BoothReportPanel({
  filter,
  icon,
  onFilterChange,
  report,
  title,
}: Readonly<{
  filter: number | "all";
  icon: ReactNode;
  onFilterChange: (filter: number | "all") => void;
  report: AdminBoothReport;
  title: string;
}>) {
  const filteredSummaries = useMemo(
    () =>
      filter === "all"
        ? report.summaries
        : report.summaries.filter((summary) => summary.boothNumber === filter),
    [filter, report.summaries],
  );
  const filteredTransactions = useMemo(
    () =>
      filter === "all"
        ? report.transactions
        : report.transactions.filter(
            (transaction) => transaction.boothNumber === filter,
          ),
    [filter, report.transactions],
  );
  const totalTokens = filteredSummaries.reduce(
    (total, summary) => total + summary.netTokens,
    0,
  );

  function exportBooths(): void {
    downloadCsv(
      `tokenly-${report.category}-booth-report.csv`,
      [
        "Occurred at UTC",
        "Booth",
        "Vendor",
        "Username",
        "Reference",
        "Entry type",
        "Direction",
        "Token amount",
        "Description",
        "Transaction group",
      ],
      filteredTransactions.map((transaction) => [
        transaction.occurredAt,
        transaction.boothNumber,
        transaction.vendorName,
        transaction.vendorUsername,
        transaction.reference,
        transaction.entryType,
        transaction.direction,
        transaction.tokenAmount.toFixed(2),
        transaction.description,
        transaction.transactionGroupId,
      ]),
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-card bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong [&>svg]:size-6">
              {icon}
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {formatTokenAmount(totalTokens)} net tokens across{" "}
                {filteredSummaries.length} booth
                {filteredSummaries.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {report.category !== "vendor1" && (
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                Booth
                <select
                  value={filter}
                  onChange={(event) =>
                    onFilterChange(
                      event.target.value === "all"
                        ? "all"
                        : Number(event.target.value),
                    )
                  }
                  className="min-h-11 rounded-full bg-canvas px-4 py-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <option value="all">All</option>
                  {[1, 2, 3, 4, 5, 6].map((boothNumber) => (
                    <option key={boothNumber} value={boothNumber}>
                      Booth {boothNumber}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={exportBooths}
              disabled={filteredTransactions.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-blue-soft px-4 py-2 font-bold text-brand-blue-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download aria-hidden="true" className="size-4" />
              Export for Sheets
            </button>
          </div>
        </div>
      </div>

      {filteredSummaries.length === 0 ? (
        <EmptyReport icon={<Store />} title="No booth activity yet" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSummaries.map((summary) => (
            <BoothSummaryCard key={summary.vendorId} summary={summary} />
          ))}
        </div>
      )}

      {filteredTransactions.length > 0 && (
        <section className="overflow-hidden rounded-card bg-white shadow-soft">
          <div className="border-b border-ink/6 px-5 py-4 sm:px-6">
            <h3 className="text-lg font-bold text-ink">Booth transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="bg-canvas text-xs font-bold tracking-[0.12em] text-ink-muted uppercase">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Booth</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3 text-right">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/6">
                {filteredTransactions.map((transaction) => (
                  <BoothTransactionRow
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

function BoothSummaryCard({
  summary,
}: Readonly<{
  summary: AdminBoothSummary;
}>) {
  return (
    <article className="rounded-card bg-white p-5 shadow-soft">
      <p className="text-sm font-bold tracking-[0.12em] text-brand-blue-strong uppercase">
        Booth {summary.boothNumber}
      </p>
      <h3 className="mt-2 text-lg font-bold text-ink">{summary.vendorName}</h3>
      <p className="mt-1 text-sm text-ink-muted">{summary.stallLocation}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="font-semibold text-ink-muted">Net</dt>
          <dd className="mt-1 font-bold text-ink tabular-nums">
            {formatTokenAmount(summary.netTokens)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">In</dt>
          <dd className="mt-1 font-bold text-success tabular-nums">
            {formatTokenAmount(summary.creditedTokens)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-muted">Out</dt>
          <dd className="mt-1 font-bold text-danger tabular-nums">
            {formatTokenAmount(summary.debitedTokens)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function BoothTransactionRow({
  transaction,
}: Readonly<{
  transaction: AdminBoothTransactionItem;
}>) {
  const isCredit = transaction.direction === "credit";

  return (
    <tr>
      <td className="px-5 py-4 align-top text-ink-muted">
        {formatOccurredAt(transaction.occurredAt)}
      </td>
      <td className="px-5 py-4 align-top font-bold text-ink">
        Booth {transaction.boothNumber}
      </td>
      <td className="px-5 py-4 align-top">
        <span className="block font-semibold text-ink">
          {transaction.vendorName}
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          {transaction.vendorUsername}
        </span>
      </td>
      <td className="px-5 py-4 align-top">
        <span className="block font-mono text-xs text-ink">
          {transaction.reference}
        </span>
        <span className="mt-1 block text-xs text-ink-muted">
          {formatEntryType(transaction.entryType)}
        </span>
      </td>
      <td
        className={`px-5 py-4 text-right align-top font-bold whitespace-nowrap tabular-nums ${
          isCredit ? "text-success" : "text-danger"
        }`}
      >
        {isCredit ? "+" : "-"}
        {formatTokenAmount(transaction.tokenAmount)}
      </td>
    </tr>
  );
}

function EmptyReport({
  icon,
  title,
}: Readonly<{
  icon: ReactNode;
  title: string;
}>) {
  return (
    <section className="rounded-card bg-white p-8 text-center shadow-soft">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-canvas text-ink-muted [&>svg]:size-7">
        {icon}
      </span>
      <h2 className="mt-4 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-ink-muted">
        Supabase is connected. Matching hosted activity will appear here.
      </p>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: number;
}>) {
  return (
    <article className="rounded-card bg-white p-5 shadow-soft">
      <span className="grid size-10 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-4 text-3xl font-bold text-ink tabular-nums">
        {formatTokenAmount(value)}
      </p>
      <p className="mt-1 text-sm font-medium text-ink-muted">{label}</p>
    </article>
  );
}
