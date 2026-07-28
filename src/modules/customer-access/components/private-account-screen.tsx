"use client";

import Image from "next/image";
import { RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { generateTokenlyQrCodeDataUrl } from "@/config/qr-code-image-generator";

import type { PrivateAccountReadModel } from "../customer-access-read-model";

export interface PrivateAccountScreenProps {
  readonly privateAccessCode: string;
  readonly loadAccount: (
    privateAccessCode: string,
  ) => Promise<PrivateAccountReadModel>;
  readonly regenerateWalletQr: (privateAccessCode: string) => Promise<void>;
}

type PrivateAccountState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | {
      readonly status: "ready";
      readonly imageDataUrl: string;
      readonly value: PrivateAccountReadModel;
    };

export function PrivateAccountScreen({
  privateAccessCode,
  loadAccount,
  regenerateWalletQr,
}: PrivateAccountScreenProps) {
  const [state, setState] = useState<PrivateAccountState>({
    status: "loading",
  });
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationMessage, setRegenerationMessage] = useState<string | null>(
    null,
  );

  const reload = useCallback(async (): Promise<void> => {
    setState({ status: "loading" });

    try {
      const value = await loadAccount(privateAccessCode);
      const imageDataUrl = await generateTokenlyQrCodeDataUrl(
        value.walletQrPayload,
      );
      setState({ status: "ready", imageDataUrl, value });
    } catch {
      setState({ status: "error" });
    }
  }, [loadAccount, privateAccessCode]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(async () => {
      if (!active) {
        return;
      }

      setState({ status: "loading" });

      try {
        const value = await loadAccount(privateAccessCode);
        const imageDataUrl = await generateTokenlyQrCodeDataUrl(
          value.walletQrPayload,
        );
        if (active) {
          setState({ status: "ready", imageDataUrl, value });
        }
      } catch {
        if (active) {
          setState({ status: "error" });
        }
      }
    });

    return () => {
      active = false;
    };
  }, [loadAccount, privateAccessCode]);

  async function regenerate(): Promise<void> {
    setRegenerationMessage(null);
    setIsRegenerating(true);

    try {
      await regenerateWalletQr(privateAccessCode);
      const value = await loadAccount(privateAccessCode);
      const imageDataUrl = await generateTokenlyQrCodeDataUrl(
        value.walletQrPayload,
      );
      setState({ status: "ready", imageDataUrl, value });
      setRegenerationMessage(
        "Your new wallet QR is active. Older wallet QR codes no longer work.",
      );
    } catch {
      setRegenerationMessage("Your wallet QR could not be regenerated.");
    } finally {
      setIsRegenerating(false);
    }
  }

  if (state.status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 shadow-soft"
        >
          Opening your Tokenly account...
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <section className="w-full max-w-md rounded-card bg-white p-6 text-center shadow-soft">
          <h1 className="text-2xl font-bold text-ink">
            Account link unavailable
          </h1>
          <p role="alert" className="mt-3 leading-7 text-ink-muted">
            This private Tokenly account link could not be opened. Ask the event
            desk for help.
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-5 min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <section className="tokenly-court-lines relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-floating sm:p-8">
          <p className="text-sm font-semibold tracking-[0.1em] text-white/70 uppercase">
            Private Tokenly QR
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {state.value.displayName}
          </h1>
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-white/70">Wallet balance</p>
              <p className="mt-1 text-[clamp(3.5rem,14vw,6rem)] leading-none font-bold tracking-[-0.065em] tabular-nums">
                {state.value.balance}
              </p>
              <p className="mt-1 font-medium text-white/72">tokens</p>
            </div>
            <span className="grid size-16 place-items-center rounded-[1.5rem] bg-white/10">
              <WalletCards aria-hidden="true" className="size-8" />
            </span>
          </div>
        </section>

        <section className="mt-6 rounded-card bg-white p-6 text-center shadow-soft">
          <p className="text-sm font-bold tracking-[0.14em] text-brand-blue-strong uppercase">
            Wallet QR
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">
            Show vendors this code
          </h2>
          <div className="mx-auto mt-5 w-fit rounded-[2rem] border border-ink/10 bg-white p-4 shadow-soft">
            <Image
              unoptimized
              src={state.imageDataUrl}
              alt="Tokenly wallet QR code for vendor charges and refunds"
              width={320}
              height={320}
              className="size-64"
            />
          </div>
          <p className="mt-4 font-mono text-sm break-all text-ink-muted">
            {state.value.walletPublicCode}
          </p>
          <button
            type="button"
            disabled={isRegenerating}
            onClick={() => void regenerate()}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white shadow-raised disabled:cursor-wait disabled:bg-ink-muted"
          >
            <RefreshCw aria-hidden="true" className="size-5" />
            {isRegenerating ? "Regenerating..." : "Regenerate wallet QR"}
          </button>
          {regenerationMessage !== null && (
            <p
              role="status"
              className="mt-4 rounded-2xl bg-brand-mint-soft p-3 text-sm font-medium text-brand-mint-strong"
            >
              {regenerationMessage}
            </p>
          )}
          <p className="mt-4 text-sm leading-6 text-ink-muted">
            Save this private link. Anyone with it can open this QR page.
            Regenerating the QR invalidates older wallet QR codes, but this
            private link stays active.
          </p>
        </section>
      </div>
    </main>
  );
}
