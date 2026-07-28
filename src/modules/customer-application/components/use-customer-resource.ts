"use client";

import { useCallback, useEffect, useState } from "react";

export type CustomerResourceState<Data> =
  | {
      readonly status: "error";
    }
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "ready";
      readonly data: Data;
    };

export function useCustomerResource<Data>(load: () => Promise<Data>): Readonly<{
  retry: () => void;
  state: CustomerResourceState<Data>;
}> {
  const [attempt, setAttempt] = useState(0);
  const [settledResource, setSettledResource] = useState<{
    readonly attempt: number;
    readonly load: () => Promise<Data>;
    readonly state: Exclude<
      CustomerResourceState<Data>,
      { readonly status: "loading" }
    >;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void load().then(
      (data) => {
        if (isCurrent) {
          setSettledResource({
            attempt,
            load,
            state: { status: "ready", data },
          });
        }
      },
      () => {
        if (isCurrent) {
          setSettledResource({
            attempt,
            load,
            state: { status: "error" },
          });
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [attempt, load]);

  const retry = useCallback((): void => {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const state: CustomerResourceState<Data> =
    settledResource?.load === load && settledResource.attempt === attempt
      ? settledResource.state
      : { status: "loading" };

  return { retry, state };
}
