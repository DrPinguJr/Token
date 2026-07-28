"use client";

import {
  ArrowRight,
  MapPin,
  Search,
  ShoppingBasket,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CustomerVendorSummary } from "../customer-commerce";
import {
  CustomerCommerceEmptyState,
  CustomerCommerceErrorState,
  CustomerCommerceLoading,
} from "./customer-commerce-feedback";
import { CustomerCommerceImage } from "./customer-commerce-image";

export interface VendorDirectoryProps {
  readonly loadVendors: () => Promise<readonly CustomerVendorSummary[]>;
}

function getOperatingStatusLabel(
  status: CustomerVendorSummary["operatingStatus"],
): string {
  switch (status) {
    case "open":
      return "Open now";
    case "paused":
      return "Payments paused";
    case "closed":
      return "Closed";
  }
}

export function VendorDirectory({ loadVendors }: VendorDirectoryProps) {
  const [vendors, setVendors] = useState<
    readonly CustomerVendorSummary[] | null
  >(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        setHasLoadError(false);
        setVendors(null);
      }
    });
    void loadVendors()
      .then((loadedVendors) => {
        if (active) {
          setVendors(loadedVendors);
        }
      })
      .catch(() => {
        if (active) {
          setHasLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [loadVendors, reloadVersion]);

  const visibleVendors = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("en-SG");

    if (vendors === null || normalizedSearch.length === 0) {
      return vendors ?? [];
    }

    return vendors.filter((vendor) =>
      [
        vendor.displayName,
        vendor.description,
        vendor.stallLocation,
        ...vendor.categories,
      ].some((value) =>
        value.toLocaleLowerCase("en-SG").includes(normalizedSearch),
      ),
    );
  }, [search, vendors]);

  if (hasLoadError) {
    return (
      <CustomerCommerceErrorState
        title="Vendors could not load"
        message="Your vendor list is still safe. Check this browser's local data and try again."
        onRetry={() => setReloadVersion((current) => current + 1)}
      />
    );
  }

  if (vendors === null) {
    return <CustomerCommerceLoading label="Finding event vendors…" />;
  }

  if (vendors.length === 0) {
    return (
      <CustomerCommerceEmptyState
        title="No vendors yet"
        message="Event vendors will appear here when their local storefronts are ready."
      />
    );
  }

  return (
    <section aria-labelledby="vendor-directory-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand-pink-strong uppercase">
            Event marketplace
          </p>
          <h1
            id="vendor-directory-heading"
            className="mt-1 text-3xl font-bold tracking-tight text-ink"
          >
            Browse vendors
          </h1>
          <p className="mt-2 max-w-2xl leading-7 text-ink-muted">
            Find food, event keepsakes, and floorball gear around the venue.
          </p>
        </div>

        <label className="block w-full sm:max-w-sm">
          <span className="mb-2 block text-sm font-semibold text-ink">
            Search vendors
          </span>
          <span className="relative block">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try drinks or Hall A"
              className="min-h-12 w-full rounded-full bg-white py-3 pr-4 pl-12 text-ink shadow-soft outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-focus"
            />
          </span>
        </label>
      </div>

      {visibleVendors.length === 0 ? (
        <div className="mt-6">
          <CustomerCommerceEmptyState
            title="No matching vendors"
            message="Try a different vendor, location, or product category."
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleVendors.map((vendor) => (
            <li key={vendor.id}>
              <Link
                href={`/customer/vendors/${vendor.id}`}
                className="group block h-full overflow-hidden rounded-card bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus motion-reduce:transform-none"
              >
                <CustomerCommerceImage
                  src={vendor.banner}
                  alt={`${vendor.displayName} storefront`}
                  sizes="(min-width: 1280px) 28vw, (min-width: 768px) 44vw, 92vw"
                  className="aspect-[16/7] w-full"
                />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CustomerCommerceImage
                        src={vendor.logo}
                        alt={`${vendor.displayName} logo`}
                        sizes="48px"
                        className="h-12 w-12 shrink-0 rounded-2xl"
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-ink">
                          {vendor.displayName}
                        </h2>
                        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
                          <MapPin
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate">
                            {vendor.stallLocation}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        vendor.operatingStatus === "open"
                          ? "bg-brand-mint-soft text-brand-mint-strong"
                          : "bg-canvas-soft text-ink-muted"
                      }`}
                    >
                      {getOperatingStatusLabel(vendor.operatingStatus)}
                    </span>
                  </div>

                  <p className="mt-4 line-clamp-2 leading-6 text-ink-muted">
                    {vendor.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-ink-soft">
                      {vendor.availableProductCount > 0 ? (
                        <ShoppingBasket
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      ) : (
                        <Store aria-hidden="true" className="h-4 w-4" />
                      )}
                      {vendor.availableProductCount} available{" "}
                      {vendor.availableProductCount === 1
                        ? "product"
                        : "products"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-blue-strong">
                      View stall
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
