import type { EventSettingsRepository } from "@/modules/event-settings";

export interface EventHelpQueryRepositories {
  readonly eventSettings: Pick<EventSettingsRepository, "get">;
}

export interface DevelopmentHelpAccount {
  readonly mobileNumber: string;
  readonly role: "administrator" | "customer" | "staff" | "vendor";
}

export interface DevelopmentHelpAccess {
  readonly accounts: readonly DevelopmentHelpAccount[];
  readonly pin: string;
}

export interface EventHelpReadModel {
  readonly developmentAccess: DevelopmentHelpAccess | null;
  readonly event: {
    readonly name: string;
    readonly venue: string;
  } | null;
  readonly support: {
    readonly contact: string;
    readonly instructions: string;
    readonly label: string;
  } | null;
}

export interface EventHelpQueryDependencies {
  readonly developmentAccess: DevelopmentHelpAccess;
  readonly isDevelopmentToolsEnabled: () => boolean;
  readonly repositories: EventHelpQueryRepositories;
}

export class EventHelpQuery {
  public constructor(
    private readonly dependencies: EventHelpQueryDependencies,
  ) {}

  public async get(): Promise<EventHelpReadModel> {
    const settings = await this.dependencies.repositories.eventSettings.get();
    const developmentAccess = this.dependencies.isDevelopmentToolsEnabled()
      ? this.dependencies.developmentAccess
      : null;

    return Object.freeze({
      developmentAccess,
      event:
        settings === null
          ? null
          : Object.freeze({
              name: settings.eventName,
              venue: settings.venue,
            }),
      support:
        settings === null
          ? null
          : Object.freeze({
              contact: settings.supportContact,
              instructions: settings.supportInstructions,
              label: settings.supportLabel,
            }),
    });
  }
}
