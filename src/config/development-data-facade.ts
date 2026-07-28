import {
  resetLocalData,
  type LocalDataInitializationResult,
} from "./local-data";
import { areDevelopmentToolsEnabled } from "./development-tools";
import { initializeTokenlyApplicationData } from "./seed-tokenly-local-data";

export interface DevelopmentDataResetOptions {
  readonly includePreferences?: boolean;
}

export interface DevelopmentDataFacadeDependencies {
  readonly isEnabled: () => boolean;
  readonly resetData: () => Promise<void>;
  readonly initializeData: () => Promise<LocalDataInitializationResult>;
  readonly clearScopedPreferences?: () => Promise<void> | void;
}

export interface DevelopmentDataFacade {
  readonly reset: (options?: DevelopmentDataResetOptions) => Promise<void>;
  readonly reseed: (
    options?: DevelopmentDataResetOptions,
  ) => Promise<LocalDataInitializationResult>;
}

export class DevelopmentDataToolsDisabledError extends Error {
  readonly code = "DEVELOPMENT_DATA_TOOLS_DISABLED";

  constructor() {
    super("Tokenly development data tools are disabled.");
    this.name = "DevelopmentDataToolsDisabledError";
  }
}

export class DevelopmentPreferenceResetUnavailableError extends Error {
  readonly code = "DEVELOPMENT_PREFERENCE_RESET_UNAVAILABLE";

  constructor() {
    super("A scoped preference reset has not been configured.");
    this.name = "DevelopmentPreferenceResetUnavailableError";
  }
}

function assertEnabled(isEnabled: () => boolean): void {
  if (!isEnabled()) {
    throw new DevelopmentDataToolsDisabledError();
  }
}

function assertPreferenceResetIsConfigured(
  options: DevelopmentDataResetOptions,
  clearScopedPreferences:
    DevelopmentDataFacadeDependencies["clearScopedPreferences"] | undefined,
): void {
  if (
    options.includePreferences === true &&
    clearScopedPreferences === undefined
  ) {
    throw new DevelopmentPreferenceResetUnavailableError();
  }
}

async function clearPreferencesWhenRequested(
  options: DevelopmentDataResetOptions,
  clearScopedPreferences: NonNullable<
    DevelopmentDataFacadeDependencies["clearScopedPreferences"]
  >,
): Promise<void> {
  if (options.includePreferences !== true) {
    return;
  }

  await clearScopedPreferences();
}

export function createDevelopmentDataFacade(
  dependencies: DevelopmentDataFacadeDependencies,
): DevelopmentDataFacade {
  return {
    reset: async (options = {}) => {
      assertEnabled(dependencies.isEnabled);
      assertPreferenceResetIsConfigured(
        options,
        dependencies.clearScopedPreferences,
      );
      await dependencies.resetData();
      if (dependencies.clearScopedPreferences !== undefined) {
        await clearPreferencesWhenRequested(
          options,
          dependencies.clearScopedPreferences,
        );
      }
    },
    reseed: async (options = {}) => {
      assertEnabled(dependencies.isEnabled);
      assertPreferenceResetIsConfigured(
        options,
        dependencies.clearScopedPreferences,
      );
      await dependencies.resetData();
      if (dependencies.clearScopedPreferences !== undefined) {
        await clearPreferencesWhenRequested(
          options,
          dependencies.clearScopedPreferences,
        );
      }
      return dependencies.initializeData();
    },
  };
}

export interface CreateConfiguredDevelopmentDataFacadeOptions {
  readonly clearScopedPreferences?: () => Promise<void> | void;
}

export function createConfiguredDevelopmentDataFacade(
  options: CreateConfiguredDevelopmentDataFacadeOptions = {},
): DevelopmentDataFacade {
  return createDevelopmentDataFacade({
    isEnabled: areDevelopmentToolsEnabled,
    resetData: resetLocalData,
    initializeData: initializeTokenlyApplicationData,
    ...(options.clearScopedPreferences === undefined
      ? {}
      : { clearScopedPreferences: options.clearScopedPreferences }),
  });
}
