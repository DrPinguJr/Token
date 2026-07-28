"use client";

import {
  ArrowLeft,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  CustomerProductReadModel,
  CustomerVendorStorefront,
} from "../customer-commerce";
import { useCustomerBasket } from "./customer-basket-provider";
import {
  CustomerCommerceEmptyState,
  CustomerCommerceErrorState,
  CustomerCommerceLoading,
} from "./customer-commerce-feedback";
import { CustomerCommerceImage } from "./customer-commerce-image";

export interface VendorStorefrontProps {
  readonly vendorId: string;
  readonly loadStorefront: (
    vendorId: string,
  ) => Promise<CustomerVendorStorefront | null>;
}

interface BasketSummaryProps {
  readonly storefront: CustomerVendorStorefront;
  readonly compact?: boolean;
}

function getStatusCopy(
  status: CustomerVendorStorefront["vendor"]["operatingStatus"],
): string {
  switch (status) {
    case "open":
      return "Open for token payments";
    case "paused":
      return "Payments are paused";
    case "closed":
      return "Closed for now";
  }
}

function ProductQuantityControl({
  product,
  quantity,
  disabled,
  onQuantityChange,
}: {
  readonly product: CustomerProductReadModel;
  readonly quantity: number;
  readonly disabled: boolean;
  readonly onQuantityChange: (quantity: number) => void;
}) {
  if (quantity === 0) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantityChange(1)}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:bg-ink-muted focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
      >
        Add to basket
      </button>
    );
  }

  return (
    <div
      className="inline-flex min-h-11 items-center rounded-full bg-brand-blue-soft p-1"
      aria-label={`${product.name} quantity`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantityChange(quantity - 1)}
        aria-label={`Remove one ${product.name}`}
        className="grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Minus aria-hidden="true" className="h-5 w-5" />
      </button>
      <output
        aria-live="polite"
        aria-label={`${product.name} quantity ${quantity}`}
        className="min-w-10 text-center font-bold tabular-nums text-ink"
      >
        {quantity}
      </output>
      <button
        type="button"
        disabled={disabled || quantity >= Number.MAX_SAFE_INTEGER}
        onClick={() => onQuantityChange(quantity + 1)}
        aria-label={`Add one ${product.name}`}
        className="grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Plus aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
}

function BasketSummary({ storefront, compact = false }: BasketSummaryProps) {
  const basket = useCustomerBasket();
  const productsById = useMemo(
    () =>
      new Map(
        storefront.products.map((product) => [product.id, product] as const),
      ),
    [storefront.products],
  );
  const basketLines =
    basket.snapshot?.items.map((item) => ({
      ...item,
      product: productsById.get(item.productId) ?? null,
    })) ?? [];
  const estimatedTokenTotal = basketLines.reduce((total, line) => {
    if (line.product === null) {
      return total;
    }

    const lineTotal = line.product.tokenPrice * line.quantity;
    return Number.isSafeInteger(lineTotal) &&
      total <= Number.MAX_SAFE_INTEGER - lineTotal
      ? total + lineTotal
      : total;
  }, 0);
  const canPay =
    basket.status === "ready" &&
    basketLines.length > 0 &&
    basketLines.every((line) => line.product !== null) &&
    storefront.vendor.operatingStatus === "open";
  const hasUnavailableLine = basketLines.some(
    (line) => line.product === null,
  );

  if (compact) {
    return (
      <div>
        {hasUnavailableLine && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-brand-pink-soft p-3">
            <p role="alert" className="text-sm font-medium text-danger">
              A saved item is no longer available.
            </p>
            <button
              type="button"
              onClick={basket.discardBasket}
              className="min-h-11 shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-danger focus-visible:outline-2 focus-visible:outline-focus"
            >
              Clear basket
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink-muted">
              {basket.itemCount} {basket.itemCount === 1 ? "item" : "items"}
            </p>
            <p className="text-lg font-bold tabular-nums text-ink">
              {estimatedTokenTotal} tokens
            </p>
          </div>
          {canPay ? (
            <Link
              href={`/customer/pay/${storefront.vendor.id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
            >
              Review basket
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="min-h-12 rounded-full bg-canvas-soft px-6 py-3 font-semibold text-ink-muted"
            >
              Review basket
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <aside
      aria-labelledby="basket-summary-heading"
      className="sticky top-6 rounded-card bg-white p-6 shadow-raised"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBag
            aria-hidden="true"
            className="h-5 w-5 text-brand-pink-strong"
          />
          <h2 id="basket-summary-heading" className="text-xl font-bold text-ink">
            Your basket
          </h2>
        </div>
        {basketLines.length > 0 && (
          <button
            type="button"
            onClick={basket.discardBasket}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-danger hover:bg-brand-pink-soft focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {basket.status === "loading" ? (
        <p role="status" className="mt-5 text-sm text-ink-muted">
          Loading your basket…
        </p>
      ) : basket.status === "error" ? (
        <div className="mt-5 rounded-2xl bg-brand-pink-soft p-4">
          <p role="alert" className="text-sm font-medium text-danger">
            {basket.errorMessage}
          </p>
          <button
            type="button"
            onClick={basket.retry}
            className="mt-3 min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-focus"
          >
            Try basket again
          </button>
        </div>
      ) : basketLines.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-canvas-soft p-4 text-sm leading-6 text-ink-muted">
          Add something you like. Your basket stays with this vendor during
          this browser session.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {basketLines.map((line) => (
            <li
              key={line.productId}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-ink">
                  {line.product?.name ?? "Unavailable item"}
                </p>
                <p className="text-sm text-ink-muted">
                  {line.quantity} × {line.product?.tokenPrice ?? "—"} tokens
                </p>
              </div>
              <p className="font-bold tabular-nums text-ink">
                {line.product === null
                  ? "—"
                  : line.product.tokenPrice * line.quantity}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
        <span className="font-medium text-ink-muted">Preview total</span>
        <strong className="text-xl tabular-nums text-ink">
          {estimatedTokenTotal} tokens
        </strong>
      </div>
      <p className="mt-2 text-xs leading-5 text-ink-muted">
        Prices and availability are checked again when you pay.
      </p>

      {canPay ? (
        <Link
          href={`/customer/pay/${storefront.vendor.id}`}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          Review and pay
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-5 min-h-12 w-full rounded-full bg-canvas-soft px-6 py-3 font-semibold text-ink-muted"
        >
          Review and pay
        </button>
      )}
    </aside>
  );
}

export function VendorStorefront({
  vendorId,
  loadStorefront,
}: VendorStorefrontProps) {
  const basket = useCustomerBasket();
  const [storefront, setStorefront] =
    useState<CustomerVendorStorefront | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setHasLoaded(false);
    setHasLoadError(false);

    void loadStorefront(vendorId)
      .then((loadedStorefront) => {
        if (active) {
          setStorefront(loadedStorefront);
          setHasLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setHasLoadError(true);
          setHasLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [loadStorefront, reloadVersion, vendorId]);

  if (!hasLoaded) {
    return <CustomerCommerceLoading label="Opening the storefront…" />;
  }

  if (hasLoadError) {
    return (
      <CustomerCommerceErrorState
        title="Storefront could not load"
        message="Your basket is still safe in this browser session. Try opening the vendor again."
        onRetry={() => setReloadVersion((current) => current + 1)}
      />
    );
  }

  if (storefront === null) {
    return (
      <CustomerCommerceEmptyState
        title="Vendor not found"
        message="This vendor may no longer be part of the event."
        action={
          <Link
            href="/customer/vendors"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to vendors
          </Link>
        }
      />
    );
  }

  const basketQuantities = new Map(
    basket.snapshot?.items.map(
      (item) => [item.productId, item.quantity] as const,
    ) ?? [],
  );
  const purchasingDisabled =
    basket.status !== "ready" ||
    storefront.vendor.operatingStatus !== "open";

  return (
    <section aria-labelledby="storefront-heading">
      <Link
        href="/customer/vendors"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 font-semibold text-brand-blue-strong hover:bg-brand-blue-soft focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All vendors
      </Link>

      <div className="mt-3 overflow-hidden rounded-card bg-white shadow-soft">
        <CustomerCommerceImage
          src={storefront.vendor.banner}
          alt={`${storefront.vendor.displayName} storefront banner`}
          sizes="(min-width: 1024px) 72vw, 96vw"
          className="aspect-[16/6] w-full min-h-40"
        />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <CustomerCommerceImage
                src={storefront.vendor.logo}
                alt={`${storefront.vendor.displayName} logo`}
                sizes="64px"
                className="h-16 w-16 shrink-0 rounded-2xl shadow-soft"
              />
              <div>
                <h1
                  id="storefront-heading"
                  className="text-3xl font-bold tracking-tight text-ink"
                >
                  {storefront.vendor.displayName}
                </h1>
                <p className="mt-2 flex items-center gap-2 text-ink-muted">
                  <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {storefront.vendor.stallLocation}
                </p>
              </div>
            </div>
            <span
              className={`self-start rounded-full px-4 py-2 text-sm font-bold ${
                storefront.vendor.operatingStatus === "open"
                  ? "bg-brand-mint-soft text-brand-mint-strong"
                  : "bg-brand-pink-soft text-danger"
              }`}
            >
              {getStatusCopy(storefront.vendor.operatingStatus)}
            </span>
          </div>
          <p className="mt-5 max-w-3xl leading-7 text-ink-muted">
            {storefront.vendor.description}
          </p>
        </div>
      </div>

      <div className="mt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-7">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-wide text-brand-pink-strong uppercase">
                Current menu
              </p>
              <h2 className="mt-1 text-2xl font-bold text-ink">
                Available products
              </h2>
            </div>
            <p className="text-sm text-ink-muted">
              {storefront.products.length} available
            </p>
          </div>

          {storefront.products.length === 0 ? (
            <div className="mt-5">
              <CustomerCommerceEmptyState
                title="Nothing available right now"
                message="This vendor has no products ready for purchase. Check back later."
              />
            </div>
          ) : (
            <ul className="mt-5 grid gap-5 sm:grid-cols-2">
              {storefront.products.map((product) => {
                const quantity = basketQuantities.get(product.id) ?? 0;

                return (
                  <li
                    key={product.id}
                    className="overflow-hidden rounded-card bg-white shadow-soft"
                  >
                    <CustomerCommerceImage
                      src={product.image}
                      alt={product.name}
                      sizes="(min-width: 1024px) 28vw, (min-width: 640px) 44vw, 92vw"
                      className="aspect-[4/3] w-full"
                    />
                    <div className="p-5">
                      <span className="rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-bold text-brand-blue-strong">
                        {product.category}
                      </span>
                      <h3 className="mt-3 text-lg font-bold text-ink">
                        {product.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-ink-muted">
                        {product.description}
                      </p>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xl font-bold tabular-nums text-ink">
                          {product.tokenPrice}{" "}
                          <span className="text-sm font-medium text-ink-muted">
                            tokens
                          </span>
                        </p>
                        <ProductQuantityControl
                          product={product}
                          quantity={quantity}
                          disabled={purchasingDisabled}
                          onQuantityChange={(nextQuantity) =>
                            basket.setQuantity(product.id, nextQuantity)
                          }
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-7 hidden lg:block">
          <BasketSummary storefront={storefront} />
        </div>
      </div>

      {basket.itemCount > 0 && (
        <div className="sticky bottom-20 z-20 mt-7 rounded-card bg-white p-4 shadow-floating lg:hidden">
          <BasketSummary storefront={storefront} compact />
        </div>
      )}
    </section>
  );
}
