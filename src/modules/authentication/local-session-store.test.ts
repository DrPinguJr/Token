import { describe, expect, it } from "vitest";

import {
  BrowserLocalSessionStore,
  LocalSessionStorageError,
  TOKENLY_LOCAL_SESSION_KEY,
  TOKENLY_LOCAL_SESSION_VERSION,
  type SessionStorage,
} from "./local-session-store";

class MemorySessionStorage implements SessionStorage {
  private readonly records = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.records.get(key) ?? null;
  }

  public removeItem(key: string): void {
    this.records.delete(key);
  }

  public setItem(key: string, value: string): void {
    this.records.set(key, value);
  }
}

describe("BrowserLocalSessionStore", () => {
  it("persists only the session version and account ID", () => {
    const storage = new MemorySessionStorage();
    const store = new BrowserLocalSessionStore(storage);

    expect(store.saveAccountId("account-customer-001")).toEqual({
      version: TOKENLY_LOCAL_SESSION_VERSION,
      accountId: "account-customer-001",
    });
    expect(storage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBe(
      '{"version":1,"accountId":"account-customer-001"}',
    );
    expect(store.read()).toEqual({
      version: TOKENLY_LOCAL_SESSION_VERSION,
      accountId: "account-customer-001",
    });
  });

  it.each([
    "not-json",
    '{"version":99,"accountId":"account-customer-001"}',
    '{"version":1,"accountId":"account-customer-001","role":"administrator"}',
    '{"version":1,"mobileNumber":"90000001"}',
  ])("discards an untrusted invalid session: %s", (serializedSession) => {
    const storage = new MemorySessionStorage();
    storage.setItem(TOKENLY_LOCAL_SESSION_KEY, serializedSession);

    const store = new BrowserLocalSessionStore(storage);

    expect(store.read()).toBeNull();
    expect(storage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBeNull();
  });

  it("clears only the Tokenly session key", () => {
    const storage = new MemorySessionStorage();
    storage.setItem(TOKENLY_LOCAL_SESSION_KEY, "invalid");
    storage.setItem("unrelated.preference", "keep");

    new BrowserLocalSessionStore(storage).clear();

    expect(storage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBeNull();
    expect(storage.getItem("unrelated.preference")).toBe("keep");
  });

  it("maps unavailable storage to a stable error without its value", () => {
    const storage: SessionStorage = {
      getItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
      removeItem: () => undefined,
      setItem: () => undefined,
    };

    expect(() => new BrowserLocalSessionStore(storage).read()).toThrow(
      LocalSessionStorageError,
    );
  });
});
