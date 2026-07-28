import "fake-indexeddb/auto";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  TOKENLY_LOCAL_SESSION_KEY,
  TOKENLY_LOCAL_SESSION_VERSION,
} from "@/modules/authentication";

import { resetLocalData } from "./local-data";
import { createLocalRepositories } from "./local-repositories";
import {
  TokenlyRuntimeProvider,
  useTokenlyRuntime,
  type TokenlyRuntimeValue,
} from "./tokenly-runtime-provider";

function RuntimeProbe() {
  const runtime = useTokenlyRuntime();
  const [actionError, setActionError] = useState("none");
  const [developmentAccountCount, setDevelopmentAccountCount] = useState<
    number | null
  >(null);

  async function switchToVendor(): Promise<void> {
    setActionError("none");
    try {
      await runtime.switchDevelopmentAccount("account-vendor-001");
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.name : "UnknownActionError",
      );
    }
  }

  async function loadDevelopmentAccounts(): Promise<void> {
    setActionError("none");
    try {
      const accounts = await runtime.listDevelopmentAccounts();
      setDevelopmentAccountCount(accounts.length);
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.name : "UnknownActionError",
      );
    }
  }

  return (
    <div>
      <output aria-label="runtime status">{runtime.status}</output>
      <output aria-label="public repositories">
        {"repositories" in runtime ? "exposed" : "private"}
      </output>
      <output aria-label="session destination">
        {runtime.session?.destination ?? "signed-out"}
      </output>
      <output aria-label="action error">{actionError}</output>
      <output aria-label="development account count">
        {developmentAccountCount ?? "not-loaded"}
      </output>
      <button
        type="button"
        disabled={runtime.status !== "ready"}
        onClick={() => void runtime.enterAccount({ mobileNumber: "90000009" })}
      >
        Enter incomplete customer
      </button>
      <button
        type="button"
        disabled={runtime.status !== "ready"}
        onClick={() => void switchToVendor()}
      >
        Switch to vendor
      </button>
      <button
        type="button"
        disabled={runtime.status !== "ready"}
        onClick={() => void loadDevelopmentAccounts()}
      >
        List development accounts
      </button>
      <button type="button" onClick={runtime.signOut}>
        Sign out
      </button>
    </div>
  );
}

function RuntimeCapture({
  onRuntime,
}: Readonly<{
  onRuntime: (runtime: TokenlyRuntimeValue) => void;
}>) {
  const runtime = useTokenlyRuntime();

  useEffect(() => {
    onRuntime(runtime);
  }, [onRuntime, runtime]);

  return <output aria-label="captured runtime status">{runtime.status}</output>;
}

describe("TokenlyRuntimeProvider", () => {
  const originalDevelopmentToolsValue =
    process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;

  beforeEach(async () => {
    delete process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;
    window.localStorage.clear();
    await resetLocalData();
  });

  afterEach(async () => {
    if (originalDevelopmentToolsValue === undefined) {
      delete process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS;
    } else {
      process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS =
        originalDevelopmentToolsValue;
    }
    window.localStorage.clear();
    await resetLocalData();
  });

  it("initializes seeded IndexedDB and persists only the resolved account ID", async () => {
    const user = userEvent.setup();
    render(
      <TokenlyRuntimeProvider>
        <RuntimeProbe />
      </TokenlyRuntimeProvider>,
    );

    expect(screen.getByLabelText("runtime status")).toHaveTextContent(
      "loading",
    );
    await waitFor(
      () => {
        expect(screen.getByLabelText("runtime status")).toHaveTextContent(
          "ready",
        );
      },
      { timeout: 10_000 },
    );
    expect(screen.getByLabelText("public repositories")).toHaveTextContent(
      "private",
    );

    const repositories = await createLocalRepositories();
    expect(await repositories.accounts.list()).toHaveLength(9);

    await user.click(
      screen.getByRole("button", {
        name: "Enter incomplete customer",
      }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText("session destination")).toHaveTextContent(
        "/customer/onboarding",
      );
    });
    expect(window.localStorage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBe(
      JSON.stringify({
        version: TOKENLY_LOCAL_SESSION_VERSION,
        accountId: "account-customer-003",
      }),
    );

    await repositories.close();
  });

  it("uses the same minimal session shape for audited development switching and clears it on sign-out", async () => {
    process.env.NEXT_PUBLIC_TOKENLY_ENABLE_DEV_TOOLS = "true";
    const user = userEvent.setup();
    render(
      <TokenlyRuntimeProvider>
        <RuntimeProbe />
      </TokenlyRuntimeProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByLabelText("runtime status")).toHaveTextContent(
          "ready",
        );
      },
      { timeout: 10_000 },
    );
    await user.click(
      screen.getByRole("button", {
        name: "List development accounts",
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByLabelText("development account count"),
      ).toHaveTextContent("9");
    });
    await user.click(screen.getByRole("button", { name: "Switch to vendor" }));
    await waitFor(() => {
      expect(screen.getByLabelText("session destination")).toHaveTextContent(
        "/vendor/dashboard",
      );
    });

    expect(window.localStorage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBe(
      '{"version":1,"accountId":"account-vendor-001"}',
    );

    const repositories = await createLocalRepositories();
    const accountEntryAudits = await repositories.auditLogs.list({
      eventType: "account_entry",
      actorAccountId: "account-vendor-001",
    });
    expect(accountEntryAudits).toHaveLength(1);
    expect(accountEntryAudits[0]?.metadata).toMatchObject({
      entryMethod: "development_role_switcher",
    });

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByLabelText("session destination")).toHaveTextContent(
      "signed-out",
    );
    expect(window.localStorage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBeNull();

    await repositories.close();
  });

  it("blocks a direct development switch before lookup, audit, or session persistence", async () => {
    const user = userEvent.setup();
    render(
      <TokenlyRuntimeProvider>
        <RuntimeProbe />
      </TokenlyRuntimeProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByLabelText("runtime status")).toHaveTextContent(
          "ready",
        );
      },
      { timeout: 10_000 },
    );
    await user.click(screen.getByRole("button", { name: "Switch to vendor" }));

    await waitFor(() => {
      expect(screen.getByLabelText("action error")).toHaveTextContent(
        "DevelopmentAccountEntryDisabledError",
      );
    });
    expect(window.localStorage.getItem(TOKENLY_LOCAL_SESSION_KEY)).toBeNull();

    const repositories = await createLocalRepositories();
    await expect(
      repositories.auditLogs.list({
        eventType: "account_entry",
        actorAccountId: "account-vendor-001",
      }),
    ).resolves.toHaveLength(0);
    await repositories.close();
  });

  it("serializes rapid reloads and closes an uncommitted lifecycle on unmount", async () => {
    const capturedRuntime: {
      current: TokenlyRuntimeValue | null;
    } = { current: null };
    const captureRuntime = (runtime: TokenlyRuntimeValue): void => {
      capturedRuntime.current = runtime;
    };
    const firstRender = render(
      <TokenlyRuntimeProvider>
        <RuntimeCapture onRuntime={captureRuntime} />
      </TokenlyRuntimeProvider>,
    );

    await waitFor(
      () => {
        expect(
          screen.getByLabelText("captured runtime status"),
        ).toHaveTextContent("ready");
      },
      { timeout: 10_000 },
    );
    const readyRuntime = capturedRuntime.current;
    if (readyRuntime === null) {
      throw new Error("The runtime capture did not initialize.");
    }

    const firstReload = readyRuntime.reloadRuntime();
    const secondReload = readyRuntime.reloadRuntime();
    await expect(Promise.all([firstReload, secondReload])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    await waitFor(
      () => {
        expect(
          screen.getByLabelText("captured runtime status"),
        ).toHaveTextContent("ready");
      },
      { timeout: 10_000 },
    );

    const reloadedRuntime = capturedRuntime.current;
    if (reloadedRuntime === null) {
      throw new Error("The reloaded runtime was not captured.");
    }

    const unmountedReload = reloadedRuntime.reloadRuntime();
    firstRender.unmount();
    await expect(unmountedReload).resolves.toBeUndefined();

    render(
      <TokenlyRuntimeProvider>
        <RuntimeProbe />
      </TokenlyRuntimeProvider>,
    );
    await waitFor(
      () => {
        expect(screen.getByLabelText("runtime status")).toHaveTextContent(
          "ready",
        );
      },
      { timeout: 10_000 },
    );
  });
});
