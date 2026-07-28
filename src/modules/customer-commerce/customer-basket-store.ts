import { domainIdSchema } from "@/shared/validation";

import {
  customerBasketSnapshotSchema,
  type CustomerBasketSnapshot,
} from "./customer-commerce-schema";

export const CUSTOMER_BASKET_STORAGE_PREFIX = "tokenly.customer-basket.v1";

export interface CustomerBasketStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface CustomerBasketPreferenceStorage extends CustomerBasketStorage {
  readonly length: number;
  key(index: number): string | null;
}

export class CustomerBasketStorageError extends Error {
  public readonly code = "CUSTOMER_BASKET_STORAGE_FAILED";

  public constructor() {
    super("Your basket could not be saved in this browser session.");
    this.name = "CustomerBasketStorageError";
  }
}

function createStorageKey(actorAccountId: string, vendorId: string): string {
  return `${CUSTOMER_BASKET_STORAGE_PREFIX}:${actorAccountId}:${vendorId}`;
}

function freezeSnapshot(
  snapshot: CustomerBasketSnapshot,
): CustomerBasketSnapshot {
  const items = Object.freeze(
    snapshot.items.map((item) => Object.freeze({ ...item })),
  );

  return Object.freeze({ ...snapshot, items });
}

export function createEmptyCustomerBasket(
  actorAccountId: string,
  vendorId: string,
  idempotencyKey: string,
): CustomerBasketSnapshot {
  return freezeSnapshot(
    customerBasketSnapshotSchema.parse({
      version: 1,
      actorAccountId,
      vendorId,
      idempotencyKey,
      items: [],
    }),
  );
}

export class BrowserCustomerBasketStore {
  public constructor(private readonly storage: CustomerBasketStorage) {}

  public read(
    actorAccountId: string,
    vendorId: string,
    createIdempotencyKey: () => string,
  ): CustomerBasketSnapshot {
    const parsedActorAccountId = domainIdSchema.safeParse(actorAccountId);
    const parsedVendorId = domainIdSchema.safeParse(vendorId);

    if (!parsedActorAccountId.success || !parsedVendorId.success) {
      throw new CustomerBasketStorageError();
    }

    const storageKey = createStorageKey(
      parsedActorAccountId.data,
      parsedVendorId.data,
    );
    let storedValue: string | null;

    try {
      storedValue = this.storage.getItem(storageKey);
    } catch {
      throw new CustomerBasketStorageError();
    }

    if (storedValue === null) {
      return createEmptyCustomerBasket(
        parsedActorAccountId.data,
        parsedVendorId.data,
        createIdempotencyKey(),
      );
    }

    try {
      const parsedSnapshot = customerBasketSnapshotSchema.safeParse(
        JSON.parse(storedValue) as unknown,
      );

      if (
        parsedSnapshot.success &&
        parsedSnapshot.data.actorAccountId === parsedActorAccountId.data &&
        parsedSnapshot.data.vendorId === parsedVendorId.data
      ) {
        return freezeSnapshot(parsedSnapshot.data);
      }
    } catch {
      // Untrusted or stale browser data is discarded below.
    }

    try {
      this.storage.removeItem(storageKey);
    } catch {
      throw new CustomerBasketStorageError();
    }

    return createEmptyCustomerBasket(
      parsedActorAccountId.data,
      parsedVendorId.data,
      createIdempotencyKey(),
    );
  }

  public save(snapshot: CustomerBasketSnapshot): CustomerBasketSnapshot {
    const parsedSnapshot = customerBasketSnapshotSchema.safeParse(snapshot);

    if (!parsedSnapshot.success) {
      throw new CustomerBasketStorageError();
    }

    const frozenSnapshot = freezeSnapshot(parsedSnapshot.data);

    try {
      this.storage.setItem(
        createStorageKey(
          frozenSnapshot.actorAccountId,
          frozenSnapshot.vendorId,
        ),
        JSON.stringify(frozenSnapshot),
      );
    } catch {
      throw new CustomerBasketStorageError();
    }

    return frozenSnapshot;
  }

  public clear(actorAccountId: string, vendorId: string): void {
    const parsedActorAccountId = domainIdSchema.safeParse(actorAccountId);
    const parsedVendorId = domainIdSchema.safeParse(vendorId);

    if (!parsedActorAccountId.success || !parsedVendorId.success) {
      throw new CustomerBasketStorageError();
    }

    try {
      this.storage.removeItem(
        createStorageKey(parsedActorAccountId.data, parsedVendorId.data),
      );
    } catch {
      throw new CustomerBasketStorageError();
    }
  }
}

/**
 * Clears only Tokenly's validated transient basket namespace. Callers decide
 * when sign-out/reset should include these preferences.
 */
export function clearCustomerBasketPreferences(
  storage: CustomerBasketPreferenceStorage,
): void {
  const basketKeyPrefix = `${CUSTOMER_BASKET_STORAGE_PREFIX}:`;
  const keysToRemove: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (key?.startsWith(basketKeyPrefix) === true) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch {
    throw new CustomerBasketStorageError();
  }
}
