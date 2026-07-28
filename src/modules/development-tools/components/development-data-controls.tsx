"use client";

import { DatabaseBackup, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";

export type DevelopmentDataAction = "reset" | "reseed";

export interface DevelopmentDataCommand {
  readonly action: DevelopmentDataAction;
  readonly includePreferences: boolean;
}

export interface DevelopmentDataControlsProps {
  readonly onRun: (command: DevelopmentDataCommand) => Promise<string>;
}

const confirmationPhrase = "RESET TOKENLY";

function getDataActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "The local data action failed. No success has been recorded.";
}

export function DevelopmentDataControls({
  onRun,
}: DevelopmentDataControlsProps) {
  const [confirmation, setConfirmation] = useState("");
  const [includePreferences, setIncludePreferences] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<DevelopmentDataAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isConfirmed = confirmation === confirmationPhrase;

  async function runAction(action: DevelopmentDataAction): Promise<void> {
    if (!isConfirmed || pendingAction !== null) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingAction(action);

    try {
      const message = await onRun({ action, includePreferences });
      setSuccessMessage(message);
      setConfirmation("");
    } catch (error: unknown) {
      setErrorMessage(getDataActionErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section aria-labelledby="development-data-heading">
      <div className="rounded-card bg-brand-pink-soft p-4 shadow-soft sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-danger">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-bold text-ink">Local prototype data only</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              These actions replace the fixed Tokenly IndexedDB database on this
              browser. They do not touch other sites or browser data.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold tracking-[0.12em] text-brand-blue-strong uppercase">
          Development simulator
        </p>
        <h1
          id="development-data-heading"
          className="mt-2 text-3xl font-bold tracking-[-0.035em] text-ink"
        >
          Reset local data
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-ink-muted">
          Reset leaves the database empty. Reset and reseed restores the current
          deterministic fictional event data and data version.
        </p>
      </div>

      <div className="mt-7 rounded-card bg-white p-5 shadow-soft ring-1 ring-ink/5 sm:p-6">
        <label
          htmlFor="development-data-confirmation"
          className="block font-semibold text-ink"
        >
          Type <span className="font-mono">{confirmationPhrase}</span> to
          confirm
        </label>
        <input
          id="development-data-confirmation"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-3 min-h-12 w-full rounded-2xl bg-canvas-soft px-4 text-ink ring-1 ring-ink/10 transition outline-none focus:ring-2 focus:ring-focus"
        />

        <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-canvas-soft p-3.5">
          <input
            type="checkbox"
            checked={includePreferences}
            onChange={(event) => setIncludePreferences(event.target.checked)}
            className="mt-0.5 size-5 accent-brand-blue-strong"
          />
          <span>
            <span className="block font-semibold text-ink">
              Also clear the Tokenly session and scoped preferences
            </span>
            <span className="mt-1 block text-sm leading-5 text-ink-muted">
              Leave this unchecked to preserve the small local session
              preference.
            </span>
          </span>
        </label>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!isConfirmed || pendingAction !== null}
            onClick={() => void runAction("reset")}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-danger shadow-soft ring-1 ring-danger/20 transition hover:bg-brand-pink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Trash2 aria-hidden="true" className="size-5" />
            {pendingAction === "reset" ? "Resetting…" : "Reset data"}
          </button>
          <button
            type="button"
            disabled={!isConfirmed || pendingAction !== null}
            onClick={() => void runAction("reseed")}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pendingAction === "reseed" ? (
              <RefreshCw
                aria-hidden="true"
                className="size-5 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <DatabaseBackup aria-hidden="true" className="size-5" />
            )}
            {pendingAction === "reseed" ? "Reseeding…" : "Reset and reseed"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="mt-5">
        {successMessage !== null && (
          <p
            role="status"
            className="rounded-2xl bg-brand-mint-soft px-4 py-3 text-sm font-medium text-brand-mint-strong"
          >
            {successMessage}
          </p>
        )}
        {errorMessage !== null && (
          <p
            role="alert"
            className="rounded-2xl bg-brand-pink-soft px-4 py-3 text-sm font-medium text-danger"
          >
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}
