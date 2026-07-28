"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { walletOperationIdempotencyKeySchema } from "@/modules/transactions";
import { domainIdSchema, positiveSafeIntegerSchema } from "@/shared/validation";

import {
  BrowserCustomerBasketStore,
  CustomerBasketStorageError,
  createEmptyCustomerBasket,
} from "../customer-basket-store";
import type {
  CustomerBasketItem,
  CustomerBasketSnapshot,
} from "../customer-commerce-schema";

export type CustomerBasketStatus = "error" | "loading" | "ready";

export interface CustomerBasketValue {
  readonly status: CustomerBasketStatus;
  readonly snapshot: CustomerBasketSnapshot | null;
  readonly itemCount: number;
  readonly errorMessage: string | null;
  readonly setQuantity: (productId: string, quantity: number) => void;
  readonly discardBasket: () => void;
  readonly clearAfterCommit: () => void;
  readonly retry: () => void;
}

export interface CustomerBasketProviderProps {
  readonly actorAccountId: string;
  readonly vendorId: string;
  readonly children: ReactNode;
  readonly store?: BrowserCustomerBasketStore;
  readonly createIdempotencyKey?: () => string;
}

const basketErrorMessage =
  "Your basket could not be loaded or saved. Try again.";

const CustomerBasketContext = createContext<CustomerBasketValue | null>(null);

function createBrowserIdempotencyKey(): string {
  if (
    typeof globalThis.crypto !== "object" ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    throw new CustomerBasketStorageError();
  }

  return walletOperationIdempotencyKeySchema.parse(
    `customer-purchase:${globalThis.crypto.randomUUID()}`,
  );
}

function sortItems(
  items: readonly CustomerBasketItem[],
): readonly CustomerBasketItem[] {
  return Object.freeze(
    [...items].sort((left, right) =>
      left.productId.localeCompare(right.productId, "en-SG"),
    ),
  );
}

export function CustomerBasketProvider({
  actorAccountId,
  vendorId,
  children,
  store,
  createIdempotencyKey = createBrowserIdempotencyKey,
}: CustomerBasketProviderProps) {
  const [status, setStatus] = useState<CustomerBasketStatus>("loading");
  const [snapshot, setSnapshot] = useState<CustomerBasketSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const storeRef = useRef<BrowserCustomerBasketStore | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) {
        return;
      }

      try {
        const resolvedStore =
          store ?? new BrowserCustomerBasketStore(window.sessionStorage);
        const loadedSnapshot = resolvedStore.read(
          actorAccountId,
          vendorId,
          createIdempotencyKey,
        );
        storeRef.current = resolvedStore;
        setSnapshot(loadedSnapshot);
        setErrorMessage(null);
        setStatus("ready");
      } catch {
        storeRef.current = null;
        setSnapshot(null);
        setErrorMessage(basketErrorMessage);
        setStatus("error");
      }
    });

    return () => {
      active = false;
    };
  }, [actorAccountId, createIdempotencyKey, reloadVersion, store, vendorId]);

  const persistItems = useCallback(
    (items: readonly CustomerBasketItem[]): void => {
      const resolvedStore = storeRef.current;

      if (status !== "ready" || snapshot === null || resolvedStore === null) {
        return;
      }

      try {
        const nextSnapshot = resolvedStore.save({
          version: 1,
          actorAccountId: snapshot.actorAccountId,
          vendorId: snapshot.vendorId,
          idempotencyKey: createIdempotencyKey(),
          items: sortItems(items),
        });
        setSnapshot(nextSnapshot);
        setErrorMessage(null);
      } catch {
        setErrorMessage(basketErrorMessage);
        setStatus("error");
      }
    },
    [createIdempotencyKey, snapshot, status],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number): void => {
      if (snapshot === null || !domainIdSchema.safeParse(productId).success) {
        return;
      }

      const existingItems = snapshot.items.filter(
        (item) => item.productId !== productId,
      );

      if (quantity <= 0) {
        persistItems(existingItems);
        return;
      }

      const parsedQuantity = positiveSafeIntegerSchema.safeParse(quantity);
      if (!parsedQuantity.success) {
        return;
      }

      persistItems([
        ...existingItems,
        Object.freeze({ productId, quantity: parsedQuantity.data }),
      ]);
    },
    [persistItems, snapshot],
  );

  const resetBasket = useCallback(
    (clearPersistedBasket: boolean): void => {
      const resolvedStore = storeRef.current;

      if (resolvedStore === null) {
        return;
      }

      try {
        if (clearPersistedBasket) {
          resolvedStore.clear(actorAccountId, vendorId);
        }

        setSnapshot(
          createEmptyCustomerBasket(
            actorAccountId,
            vendorId,
            createIdempotencyKey(),
          ),
        );
        setErrorMessage(null);
        setStatus("ready");
      } catch {
        setErrorMessage(basketErrorMessage);
        setStatus("error");
      }
    },
    [actorAccountId, createIdempotencyKey, vendorId],
  );

  const discardBasket = useCallback(
    (): void => resetBasket(true),
    [resetBasket],
  );
  const clearAfterCommit = useCallback(
    (): void => resetBasket(true),
    [resetBasket],
  );
  const retry = useCallback((): void => {
    setStatus("loading");
    setReloadVersion((current) => current + 1);
  }, []);

  const itemCount =
    snapshot?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const value = useMemo<CustomerBasketValue>(
    () => ({
      status,
      snapshot,
      itemCount,
      errorMessage,
      setQuantity,
      discardBasket,
      clearAfterCommit,
      retry,
    }),
    [
      clearAfterCommit,
      discardBasket,
      errorMessage,
      itemCount,
      retry,
      setQuantity,
      snapshot,
      status,
    ],
  );

  return (
    <CustomerBasketContext.Provider value={value}>
      {children}
    </CustomerBasketContext.Provider>
  );
}

export function useCustomerBasket(): CustomerBasketValue {
  const basket = useContext(CustomerBasketContext);

  if (basket === null) {
    throw new CustomerBasketStorageError();
  }

  return basket;
}
