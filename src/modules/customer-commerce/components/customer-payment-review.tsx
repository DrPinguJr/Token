"use client";

import {
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { walletPinSchema } from "@/modules/authentication";
import type { PurchaseReceipt } from "@/modules/orders";

import {
  CustomerCommerceError,
  getCustomerCommerceErrorMessage,
} from "../customer-commerce-error";
import type { CustomerPaymentReviewReadModel } from "../customer-commerce";
import type {
  CustomerPaymentReviewQueryInput,
  CustomerPurchaseInput,
} from "../customer-commerce-schema";
import { useCustomerBasket } from "./customer-basket-provider";
import {
  CustomerCommerceEmptyState,
  CustomerCommerceErrorState,
  CustomerCommerceLoading,
} from "./customer-commerce-feedback";
import { CustomerCommerceImage } from "./customer-commerce-image";

export interface CustomerPaymentReviewProps {
  readonly actorAccountId: string;
  readonly customerId: string;
  readonly vendorId: string;
  readonly loadReview: (
    input: CustomerPaymentReviewQueryInput,
  ) => Promise<CustomerPaymentReviewReadModel>;
  readonly completePurchase: (
    input: CustomerPurchaseInput,
  ) => Promise<PurchaseReceipt>;
  readonly onReceipt: (receipt: PurchaseReceipt) => void;
}

function getPurchaseErrorMessage(error: unknown): string {
  if (
    error instanceof CustomerCommerceError &&
    error.code === "CUSTOMER_PURCHASE_PIN_LOCKED" &&
    error.lockedUntil !== null
  ) {
    const retryTime = new Date(error.lockedUntil);

    if (!Number.isNaN(retryTime.getTime())) {
      return `PIN entry is temporarily unavailable. Try again after ${retryTime.toLocaleTimeString(
        "en-SG",
        { hour: "numeric", minute: "2-digit" },
      )}.`;
    }
  }

  return getCustomerCommerceErrorMessage(error);
}

export function CustomerPaymentReview({
  actorAccountId,
  customerId,
  vendorId,
  loadReview,
  completePurchase,
  onReceipt,
}: CustomerPaymentReviewProps) {
  const basket = useCustomerBasket();
  const [review, setReview] =
    useState<CustomerPaymentReviewReadModel | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedReceipt, setCompletedReceipt] =
    useState<PurchaseReceipt | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const basketSignature = useMemo(
    () =>
      basket.snapshot?.items
        .map(({ productId, quantity }) => `${productId}:${quantity}`)
        .join("|") ?? "",
    [basket.snapshot?.items],
  );

  useEffect(() => {
    if (
      basket.status !== "ready" ||
      basket.snapshot === null ||
      basket.snapshot.items.length === 0
    ) {
      setReview(null);
      setReviewError(null);
      return;
    }

    let active = true;
    setReview(null);
    setReviewError(null);

    void loadReview({
      actorAccountId,
      vendorId,
      items: basket.snapshot.items,
    })
      .then((loadedReview) => {
        if (active) {
          setReview(loadedReview);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setReviewError(getCustomerCommerceErrorMessage(error));
        }
      });

    return () => {
      active = false;
    };
  }, [
    actorAccountId,
    basket.snapshot,
    basket.status,
    basketSignature,
    loadReview,
    reloadVersion,
    vendorId,
  ]);

  async function submitPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPurchaseError(null);
    setPinError(null);

    const form = event.currentTarget;
    const parsedPin = walletPinSchema.safeParse(
      new FormData(form).get("wallet-pin"),
    );

    if (!parsedPin.success) {
      setPinError("Enter your four-digit wallet PIN.");
      return;
    }

    if (
      review === null ||
      basket.snapshot === null ||
      basket.snapshot.items.length === 0
    ) {
      setPurchaseError(
        "Your payment review is not ready. Your basket is still here.",
      );
      return;
    }

    form.reset();
    setIsSubmitting(true);

    try {
      const receipt = await completePurchase({
        actorAccountId,
        customerId,
        vendorId,
        items: basket.snapshot.items,
        idempotencyKey: basket.snapshot.idempotencyKey,
        pin: parsedPin.data,
      });

      basket.clearAfterCommit();
      setCompletedReceipt(receipt);
      onReceipt(receipt);
    } catch (error: unknown) {
      setPurchaseError(getPurchaseErrorMessage(error));

      if (
        error instanceof CustomerCommerceError &&
        (error.code === "CUSTOMER_PURCHASE_PRODUCT_UNAVAILABLE" ||
          error.code === "CUSTOMER_PURCHASE_INSUFFICIENT_BALANCE" ||
          error.code === "CUSTOMER_PURCHASE_VENDOR_CLOSED")
      ) {
        setReloadVersion((current) => current + 1);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (completedReceipt !== null) {
    return (
      <div
        role="status"
        className="rounded-card bg-brand-mint-soft p-8 text-center shadow-soft"
      >
        <CheckCircle2
          aria-hidden="true"
          className="mx-auto h-12 w-12 text-brand-mint-strong"
        />
        <h1 className="mt-4 text-3xl font-bold text-ink">
          Enjoy your order
        </h1>
        <p className="mt-2 text-ink-muted">
          Payment {completedReceipt.reference} is complete. Opening your
          receipt…
        </p>
      </div>
    );
  }

  if (basket.status === "loading") {
    return <CustomerCommerceLoading label="Loading your basket…" />;
  }

  if (basket.status === "error") {
    return (
      <CustomerCommerceErrorState
        title="Basket unavailable"
        message={basket.errorMessage ?? "Your basket could not be loaded."}
        onRetry={basket.retry}
      />
    );
  }

  if (
    basket.snapshot === null ||
    basket.snapshot.items.length === 0
  ) {
    return (
      <CustomerCommerceEmptyState
        title="Your basket is empty"
        message="Choose something from the vendor before paying."
        action={
          <Link
            href={`/customer/vendors/${vendorId}`}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to storefront
          </Link>
        }
      />
    );
  }

  if (reviewError !== null) {
    return (
      <CustomerCommerceErrorState
        title="Basket needs another look"
        message={`${reviewError} Your basket has not been cleared.`}
        onRetry={() => setReloadVersion((current) => current + 1)}
      />
    );
  }

  if (review === null) {
    return <CustomerCommerceLoading label="Checking your basket…" />;
  }

  const hasEnoughTokens =
    review.estimatedTokenTotal <= review.customerBalance;
  const vendorIsOpen = review.vendor.operatingStatus === "open";

  return (
    <section aria-labelledby="payment-review-heading">
      <Link
        href={`/customer/vendors/${vendorId}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 font-semibold text-brand-blue-strong hover:bg-brand-blue-soft focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Edit basket
      </Link>

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-7">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-pink-strong uppercase">
              Secure local payment
            </p>
            <h1
              id="payment-review-heading"
              className="mt-1 text-3xl font-bold tracking-tight text-ink"
            >
              Review your order
            </h1>
            <p className="mt-2 leading-7 text-ink-muted">
              Paying {review.vendor.displayName}. Prices and availability are
              checked again when you confirm.
            </p>
          </div>

          <div className="rounded-card bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-ink">Basket items</h2>
              <span className="text-sm font-medium text-ink-muted">
                {review.items.reduce(
                  (total, item) => total + item.quantity,
                  0,
                )}{" "}
                items
              </span>
            </div>
            <ul className="mt-5 divide-y divide-black/5">
              {review.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <CustomerCommerceImage
                    src={item.image}
                    alt={item.name}
                    sizes="64px"
                    className="h-16 w-16 shrink-0 rounded-2xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{item.name}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {item.quantity} × {item.tokenPrice} tokens
                    </p>
                  </div>
                  <p className="font-bold tabular-nums text-ink">
                    {item.lineTokenTotal}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <form
            id="customer-payment-form"
            onSubmit={(event) => void submitPurchase(event)}
            className="rounded-card bg-white p-5 shadow-soft sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-blue-soft text-brand-blue-strong">
                <LockKeyhole aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Confirm with your PIN
                </h2>
                <p className="mt-1 text-sm leading-6 text-ink-muted">
                  One payment attempt uses your four-digit wallet PIN. Tokenly
                  never stores the PIN in your basket or order.
                </p>
              </div>
            </div>

            <label
              htmlFor="customer-wallet-pin"
              className="mt-5 block font-semibold text-ink"
            >
              Wallet PIN
            </label>
            <input
              id="customer-wallet-pin"
              name="wallet-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4}"
              maxLength={4}
              disabled={isSubmitting}
              onInput={() => setPinError(null)}
              aria-invalid={pinError !== null}
              aria-describedby={
                pinError === null ? "customer-pin-help" : "customer-pin-error"
              }
              className="mt-2 min-h-12 w-full rounded-2xl bg-canvas-soft px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait"
            />
            {pinError === null ? (
              <p
                id="customer-pin-help"
                className="mt-2 text-sm text-ink-muted"
              >
                Enter exactly four digits.
              </p>
            ) : (
              <p
                id="customer-pin-error"
                role="alert"
                className="mt-2 text-sm font-medium text-danger"
              >
                {pinError}
              </p>
            )}

            {purchaseError !== null && (
              <p
                role="alert"
                className="mt-4 rounded-2xl bg-brand-pink-soft p-4 font-medium text-danger"
              >
                {purchaseError}
              </p>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting || !hasEnoughTokens || !vendorIsOpen
              }
              className="mt-5 hidden min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised disabled:cursor-not-allowed disabled:bg-ink-muted focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus lg:inline-flex"
            >
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
              {isSubmitting
                ? "Confirming one PIN attempt…"
                : `Pay ${review.estimatedTokenTotal} tokens`}
            </button>
          </form>
        </div>

        <aside className="sticky top-6 mt-6 rounded-card bg-white p-6 shadow-raised lg:mt-0">
          <h2 className="text-xl font-bold text-ink">Payment summary</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">Preview total</dt>
              <dd className="font-bold tabular-nums text-ink">
                {review.estimatedTokenTotal} tokens
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-ink-muted">
                <WalletCards aria-hidden="true" className="h-4 w-4" />
                Wallet balance
              </dt>
              <dd className="font-bold tabular-nums text-ink">
                {review.customerBalance} tokens
              </dd>
            </div>
          </dl>

          {!hasEnoughTokens && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-brand-pink-soft p-4 font-bold text-danger"
            >
              Not enough tokens.
            </p>
          )}
          {!vendorIsOpen && (
            <p
              role="alert"
              className="mt-5 rounded-2xl bg-brand-pink-soft p-4 font-medium text-danger"
            >
              This vendor is not open for payments right now.
            </p>
          )}
          <p className="mt-5 text-xs leading-5 text-ink-muted">
            The final total comes from current repository prices inside the
            purchase transaction.
          </p>
        </aside>
      </div>

      <div className="sticky bottom-20 z-20 mt-6 rounded-card bg-white p-4 shadow-floating lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink-muted">Total</span>
          <strong className="text-xl tabular-nums text-ink">
            {review.estimatedTokenTotal} tokens
          </strong>
        </div>
        <button
          type="submit"
          form="customer-payment-form"
          disabled={isSubmitting || !hasEnoughTokens || !vendorIsOpen}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised disabled:cursor-not-allowed disabled:bg-ink-muted focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          {isSubmitting ? "Confirming…" : "Confirm payment"}
        </button>
      </div>
    </section>
  );
}
