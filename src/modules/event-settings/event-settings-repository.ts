import type { EventSettings } from "./event-settings";

export interface EventSettingsRepository {
  get(): Promise<EventSettings | null>;
  save(settings: EventSettings): Promise<void>;
}
