import {
  clearStoredRecords,
  getAllStoredRecords,
  isTokenlyReadWriteTransaction,
  parseStoredRecord,
  putStoredRecord,
  tokenlyStoreNames,
  type TokenlyPersistenceSource,
} from "@/shared/data";

import type { EventSettings } from "./event-settings";
import type { EventSettingsRepository } from "./event-settings-repository";
import { eventSettingsSchema } from "./event-settings-schema";

export class EventSettingsSingletonError extends Error {
  public readonly code = "EVENT_SETTINGS_SINGLETON_INVALID";

  public constructor() {
    super("Local event settings contain more than one record.");
    this.name = "EventSettingsSingletonError";
  }
}

export class IndexedDbEventSettingsRepository implements EventSettingsRepository {
  public constructor(private readonly database: TokenlyPersistenceSource) {}

  public async get(): Promise<EventSettings | null> {
    const settings = await getAllStoredRecords(
      this.database,
      tokenlyStoreNames.eventSettings,
      eventSettingsSchema,
    );

    if (settings.length > 1) {
      throw new EventSettingsSingletonError();
    }

    return settings[0] ?? null;
  }

  public async save(settings: EventSettings): Promise<void> {
    const parsedSettings = parseStoredRecord(
      tokenlyStoreNames.eventSettings,
      eventSettingsSchema,
      settings,
      settings.id,
    );

    if (isTokenlyReadWriteTransaction(this.database)) {
      await this.saveInTransaction(this.database, parsedSettings);
      return;
    }

    const transaction = this.database.transaction(
      [tokenlyStoreNames.eventSettings, tokenlyStoreNames.dataMetadata],
      "readwrite",
    );

    try {
      await this.saveInTransaction(transaction, parsedSettings);
      await transaction.done;
    } catch (error: unknown) {
      await transaction.done.catch(() => undefined);
      throw error;
    }
  }

  private async saveInTransaction(
    source: TokenlyPersistenceSource,
    settings: EventSettings,
  ): Promise<void> {
    await clearStoredRecords(source, tokenlyStoreNames.eventSettings);
    await putStoredRecord(
      source,
      tokenlyStoreNames.eventSettings,
      eventSettingsSchema,
      settings,
    );
  }
}
