"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import type { ClaimedPrivateAccountReadModel } from "../customer-access-read-model";

export interface ClaimAccountScreenProps {
  readonly claimCode: string;
  readonly claim: (
    claimCode: string,
  ) => Promise<ClaimedPrivateAccountReadModel>;
}

type ClaimState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "claimed";
      readonly value: ClaimedPrivateAccountReadModel;
    };

function getClaimErrorMessage(error: unknown): string {
  if (error instanceof Error && "code" in error) {
    if (error.code === "CLAIM_QR_ALREADY_USED") {
      return "This one-time claim QR has already been used. Ask the event desk to open a fresh claim QR if you did not save your link.";
    }

    if (error.code === "CLAIM_QR_EXPIRED") {
      return "This one-time claim QR has expired. Ask the event desk to open a fresh claim QR.";
    }
  }

  return "This claim QR is unavailable. Ask the event desk for help.";
}

export function ClaimAccountScreen({
  claimCode,
  claim,
}: ClaimAccountScreenProps) {
  const [state, setState] = useState<ClaimState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    void claim(claimCode)
      .then((value) => {
        if (active) {
          setState({ status: "claimed", value });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: "error", message: getClaimErrorMessage(error) });
        }
      });

    return () => {
      active = false;
    };
  }, [claim, claimCode]);

  if (state.status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p
          role="status"
          className="rounded-full bg-white px-5 py-3 shadow-soft"
        >
          Opening your Tokenly link...
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <section className="w-full max-w-md rounded-card bg-white p-6 text-center shadow-soft">
          <CircleAlert
            aria-hidden="true"
            className="mx-auto size-11 text-danger"
          />
          <h1 className="mt-4 text-2xl font-bold text-ink">
            Claim link unavailable
          </h1>
          <p role="alert" className="mt-3 leading-7 text-ink-muted">
            {state.message}
          </p>
          <Link
            href="/help"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 font-semibold text-white"
          >
            Get help
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <section className="w-full max-w-md rounded-card bg-white p-6 text-center shadow-soft">
        <CheckCircle2
          aria-hidden="true"
          className="mx-auto size-12 text-brand-mint-strong"
        />
        <h1 className="mt-4 text-3xl font-bold text-ink">
          Your QR link is ready
        </h1>
        <p className="mt-3 leading-7 text-ink-muted">
          {state.value.displayName}, save or bookmark the private Tokenly link
          on the next page. Anyone with that link can open your wallet QR, so
          keep it private.
        </p>
        <Link
          href={state.value.privateAccountPath}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 font-semibold text-white shadow-raised"
        >
          Open my QR page
        </Link>
      </section>
    </main>
  );
}
