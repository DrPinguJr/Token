import { z } from "zod";

import { domainIdSchema } from "@/shared/validation";

export const TOKENLY_LOCAL_SESSION_KEY = "tokenly.local-session";
export const TOKENLY_LOCAL_SESSION_VERSION = 1;

export const localSessionSchema = z
  .object({
    version: z.literal(TOKENLY_LOCAL_SESSION_VERSION),
    accountId: domainIdSchema,
  })
  .strict();

export type LocalSession = Readonly<z.infer<typeof localSessionSchema>>;

export interface SessionStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface LocalSessionStore {
  read(): LocalSession | null;
  saveAccountId(accountId: string): LocalSession;
  clear(): void;
}

export class LocalSessionStorageError extends Error {
  public readonly code = "LOCAL_SESSION_STORAGE_UNAVAILABLE";

  public constructor(cause: unknown) {
    super("The local Tokenly session could not be accessed.", { cause });
    this.name = "LocalSessionStorageError";
  }
}

export class BrowserLocalSessionStore implements LocalSessionStore {
  public constructor(private readonly storage: SessionStorage) {}

  public read(): LocalSession | null {
    let serializedSession: string | null;

    try {
      serializedSession = this.storage.getItem(TOKENLY_LOCAL_SESSION_KEY);
    } catch (error: unknown) {
      throw new LocalSessionStorageError(error);
    }

    if (serializedSession === null) {
      return null;
    }

    let storedValue: unknown;
    try {
      storedValue = JSON.parse(serializedSession) as unknown;
    } catch {
      return this.discardInvalidSession();
    }

    const parsedSession = localSessionSchema.safeParse(storedValue);
    return parsedSession.success
      ? Object.freeze(parsedSession.data)
      : this.discardInvalidSession();
  }

  public saveAccountId(accountId: string): LocalSession {
    const session = Object.freeze(
      localSessionSchema.parse({
        version: TOKENLY_LOCAL_SESSION_VERSION,
        accountId,
      }),
    );

    try {
      this.storage.setItem(TOKENLY_LOCAL_SESSION_KEY, JSON.stringify(session));
    } catch (error: unknown) {
      throw new LocalSessionStorageError(error);
    }

    return session;
  }

  public clear(): void {
    try {
      this.storage.removeItem(TOKENLY_LOCAL_SESSION_KEY);
    } catch (error: unknown) {
      throw new LocalSessionStorageError(error);
    }
  }

  private discardInvalidSession(): null {
    try {
      this.storage.removeItem(TOKENLY_LOCAL_SESSION_KEY);
    } catch (error: unknown) {
      throw new LocalSessionStorageError(error);
    }

    return null;
  }
}
