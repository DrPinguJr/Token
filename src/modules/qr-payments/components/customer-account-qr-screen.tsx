"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import type { CustomerAccountQrReadModel } from "../customer-account-qr-query";

export const CUSTOMER_ACCOUNT_QR_LOAD_ERROR_MESSAGE =
  "Your account code is unavailable right now. Try again.";

export interface CustomerAccountQrScreenProps {
  readonly generateQrImage: (payload: string) => Promise<string>;
  readonly loadAccountQr: () => Promise<CustomerAccountQrReadModel>;
}

interface LoadedAccountQr {
  readonly imageDataUrl: string;
  readonly readModel: CustomerAccountQrReadModel;
}

type AccountQrState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly value: LoadedAccountQr };

export function CustomerAccountQrScreen({
  generateQrImage,
  loadAccountQr,
}: CustomerAccountQrScreenProps) {
  const [state, setState] = useState<AccountQrState>({ status: "loading" });

  const load = useCallback(async (): Promise<void> => {
    setState({ status: "loading" });

    try {
      const readModel = await loadAccountQr();
      const imageDataUrl = await generateQrImage(readModel.payload);
      setState({
        status: "ready",
        value: Object.freeze({ imageDataUrl, readModel }),
      });
    } catch {
      setState({ status: "error" });
    }
  }, [generateQrImage, loadAccountQr]);

  useEffect(() => {
    let isCurrent = true;

    async function loadCurrentQr(): Promise<void> {
      try {
        const readModel = await loadAccountQr();
        const imageDataUrl = await generateQrImage(readModel.payload);

        if (isCurrent) {
          setState({
            status: "ready",
            value: Object.freeze({ imageDataUrl, readModel }),
          });
        }
      } catch {
        if (isCurrent) {
          setState({ status: "error" });
        }
      }
    }

    void loadCurrentQr();

    return () => {
      isCurrent = false;
    };
  }, [generateQrImage, loadAccountQr]);

  if (state.status === "loading") {
    return (
      <section
        aria-labelledby="account-qr-heading"
        className="mx-auto w-full max-w-xl rounded-card bg-white p-6 shadow-soft sm:p-8"
      >
        <h1
          id="account-qr-heading"
          className="text-2xl font-bold text-ink sm:text-3xl"
        >
          My account QR
        </h1>
        <p role="status" className="mt-4 text-ink-muted">
          Preparing your account code…
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        aria-labelledby="account-qr-heading"
        className="mx-auto w-full max-w-xl rounded-card bg-white p-6 text-center shadow-soft sm:p-8"
      >
        <h1
          id="account-qr-heading"
          className="text-2xl font-bold text-ink sm:text-3xl"
        >
          My account QR
        </h1>
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-brand-pink-soft px-4 py-3 font-medium text-danger"
        >
          {CUSTOMER_ACCOUNT_QR_LOAD_ERROR_MESSAGE}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-5 min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="account-qr-heading"
      className="mx-auto w-full max-w-xl rounded-card bg-white p-6 text-center shadow-soft sm:p-8"
    >
      <p className="text-sm font-bold tracking-[0.18em] text-brand-blue-strong uppercase">
        Account identification
      </p>
      <h1
        id="account-qr-heading"
        className="mt-2 text-2xl font-bold text-ink sm:text-3xl"
      >
        My account QR
      </h1>
      <p className="mx-auto mt-3 max-w-md leading-7 text-ink-muted">
        Event staff can scan this opaque account code when supported. It does
        not contain your mobile number, balance, or PIN.
      </p>

      <div className="mx-auto mt-6 w-fit rounded-[2rem] border border-ink/10 bg-white p-4 shadow-soft">
        <Image
          unoptimized
          src={state.value.imageDataUrl}
          width={320}
          height={320}
          alt="Tokenly customer account QR code"
          className="size-64 sm:size-72"
        />
      </div>

      <div className="mt-5 rounded-2xl bg-canvas-soft px-4 py-3">
        <p className="text-xs font-bold tracking-[0.16em] text-ink-muted uppercase">
          Public account code
        </p>
        <p className="mt-1 font-mono text-base font-semibold break-all text-ink">
          {state.value.readModel.publicCode}
        </p>
      </div>

      <p className="mt-5 text-sm leading-6 text-ink-muted">
        Keep the code on screen while it is scanned. Tokenly never puts wallet
        permissions or private credentials into the QR payload.
      </p>
    </section>
  );
}
