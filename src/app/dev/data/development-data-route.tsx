"use client";

import { useMemo } from "react";

import { createConfiguredDevelopmentDataFacade } from "@/config/development-data-facade";
import { useTokenlyRuntime } from "@/config/tokenly-runtime-provider";
import {
  DevelopmentDataControls,
  type DevelopmentDataCommand,
} from "@/modules/development-tools";

export function DevelopmentDataRoute() {
  const runtime = useTokenlyRuntime();
  const dataFacade = useMemo(
    () =>
      createConfiguredDevelopmentDataFacade({
        clearScopedPreferences: runtime.signOut,
      }),
    [runtime.signOut],
  );

  async function runDataCommand(
    command: DevelopmentDataCommand,
  ): Promise<string> {
    const options = { includePreferences: command.includePreferences };

    if (command.action === "reset") {
      await dataFacade.reset(options);
      await runtime.reloadRuntime({ initializeData: false });
      return command.includePreferences
        ? "Local Tokenly data and the scoped session were cleared. Reseed before returning to the application."
        : "Local Tokenly data was cleared. The scoped session was preserved; reseed before returning to the application.";
    }

    const result = await dataFacade.reseed(options);
    await runtime.reloadRuntime();

    return `Local Tokenly data is ready. Schema version ${result.metadata.schemaVersion}, seed version ${result.metadata.seedVersion}.`;
  }

  return (
    <div className="space-y-5">
      <div aria-live="polite">
        {runtime.status === "loading" && (
          <p
            role="status"
            className="rounded-card bg-brand-blue-soft p-4 font-medium text-brand-blue-strong shadow-soft"
          >
            The local runtime is refreshing. Data recovery controls remain
            available.
          </p>
        )}
        {runtime.status === "error" && (
          <p
            role="alert"
            className="rounded-card bg-brand-pink-soft p-4 font-medium text-danger shadow-soft"
          >
            The local runtime is unavailable. Reset or reseed below to recover
            it.
          </p>
        )}
      </div>

      <DevelopmentDataControls onRun={runDataCommand} />
    </div>
  );
}
