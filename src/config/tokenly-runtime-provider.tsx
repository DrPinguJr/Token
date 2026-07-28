"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AccountEntryService,
  BrowserLocalSessionStore,
  resolveAuthenticatedSessionReadModel,
  type AccountEntryRepositories,
  type AccountEntryInput,
  type AccountEntryTransactionRunner,
  type AuthenticatedSessionReadModel,
  type LocalSessionStore,
} from "@/modules/authentication";
import {
  cryptoTransactionIdProvider,
  systemTransactionClock,
} from "@/modules/transactions";
import type { DevelopmentAccountReadModel } from "@/modules/development-tools";

import { createConfiguredDevelopmentAccountQuery } from "./configured-development-account-query";
import { areDevelopmentToolsEnabled } from "./development-tools";
import {
  createLocalRepositories,
  runInLocalRepositoryTransaction,
  type LocalRepositories,
} from "./local-repositories";
import { initializeTokenlyApplicationData } from "./seed-tokenly-local-data";

export type TokenlyRuntimeStatus = "error" | "loading" | "ready";

export interface ReloadTokenlyRuntimeOptions {
  /**
   * Defaults to true. Development reset uses false to reopen an intentionally
   * empty database without immediately triggering first-run seed data.
   */
  readonly initializeData?: boolean;
}

export interface TokenlyRuntimeValue {
  readonly status: TokenlyRuntimeStatus;
  readonly session: AuthenticatedSessionReadModel | null;
  readonly errorMessage: string | null;
  readonly enterAccount: (
    input: AccountEntryInput,
  ) => Promise<AuthenticatedSessionReadModel>;
  readonly listDevelopmentAccounts: () => Promise<
    readonly DevelopmentAccountReadModel[]
  >;
  readonly switchDevelopmentAccount: (
    accountId: string,
  ) => Promise<AuthenticatedSessionReadModel>;
  readonly refreshSession: () => Promise<AuthenticatedSessionReadModel | null>;
  readonly signOut: () => void;
  readonly reloadRuntime: (
    options?: ReloadTokenlyRuntimeOptions,
  ) => Promise<void>;
}

interface TokenlyRuntimeState {
  readonly status: TokenlyRuntimeStatus;
  readonly session: AuthenticatedSessionReadModel | null;
  readonly errorMessage: string | null;
}

const runtimeUnavailableMessage =
  "Tokenly local data is unavailable. Try opening it again.";

const initialRuntimeState: TokenlyRuntimeState = {
  status: "loading",
  session: null,
  errorMessage: null,
};

const TokenlyRuntimeContext = createContext<TokenlyRuntimeValue | null>(null);

export class TokenlyRuntimeUnavailableError extends Error {
  public readonly code = "TOKENLY_RUNTIME_UNAVAILABLE";

  public constructor() {
    super(runtimeUnavailableMessage);
    this.name = "TokenlyRuntimeUnavailableError";
  }
}

function createAccountEntryTransactionRunner(): AccountEntryTransactionRunner {
  return {
    run<Result>(
      work: (repositories: AccountEntryRepositories) => Promise<Result>,
    ): Promise<Result> {
      return runInLocalRepositoryTransaction((repositories) =>
        work(repositories),
      );
    },
  };
}

function createAccountEntryService(): AccountEntryService {
  return new AccountEntryService({
    transactionRunner: createAccountEntryTransactionRunner(),
    generateAuditId: () => cryptoTransactionIdProvider.generateId("audit-log"),
    isDevelopmentToolsEnabled: areDevelopmentToolsEnabled,
    now: systemTransactionClock.now,
  });
}

async function resolveStoredSession(
  sessionStore: LocalSessionStore,
  repositories: LocalRepositories,
  clearUnavailableSession: boolean,
): Promise<AuthenticatedSessionReadModel | null> {
  const storedSession = sessionStore.read();
  if (storedSession === null) {
    return null;
  }

  const resolvedSession = await resolveAuthenticatedSessionReadModel(
    storedSession.accountId,
    repositories,
  );

  if (resolvedSession === null && clearUnavailableSession) {
    sessionStore.clear();
  }

  return resolvedSession;
}

type TokenlyRuntimeProviderProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Browser composition root for local persistence and authentication.
 *
 * IndexedDB and localStorage are touched only from effects or explicit user
 * actions. Repository handles are replaced after development data changes, and
 * stale asynchronous loads cannot overwrite a newer runtime generation.
 */
export function TokenlyRuntimeProvider({
  children,
}: TokenlyRuntimeProviderProps) {
  const [state, setState] = useState<TokenlyRuntimeState>(initialRuntimeState);
  const repositoriesRef = useRef<LocalRepositories | null>(null);
  const sessionStoreRef = useRef<LocalSessionStore | null>(null);
  const mountedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const reloadQueueRef = useRef<Promise<void>>(Promise.resolve());

  const getSessionStore = useCallback((): LocalSessionStore => {
    sessionStoreRef.current ??= new BrowserLocalSessionStore(
      window.localStorage,
    );
    return sessionStoreRef.current;
  }, []);

  const reloadRuntime = useCallback(
    (options: ReloadTokenlyRuntimeOptions = {}): Promise<void> => {
      const generation = loadGenerationRef.current + 1;
      loadGenerationRef.current = generation;

      if (mountedRef.current) {
        setState(initialRuntimeState);
      }

      const queuedReload = reloadQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== loadGenerationRef.current || !mountedRef.current) {
            return;
          }

          const previousRepositories = repositoriesRef.current;
          let openedRepositories: LocalRepositories | null = null;
          repositoriesRef.current = null;

          try {
            await previousRepositories?.close();

            const shouldInitialize = options.initializeData !== false;
            if (shouldInitialize) {
              await initializeTokenlyApplicationData();
            }

            if (
              generation !== loadGenerationRef.current ||
              !mountedRef.current
            ) {
              return;
            }

            const repositories = await createLocalRepositories();
            openedRepositories = repositories;
            const session = await resolveStoredSession(
              getSessionStore(),
              repositories,
              shouldInitialize,
            );

            if (
              generation !== loadGenerationRef.current ||
              !mountedRef.current
            ) {
              await repositories.close().catch(() => undefined);
              openedRepositories = null;
              return;
            }

            repositoriesRef.current = repositories;
            openedRepositories = null;
            setState({
              status: "ready",
              session,
              errorMessage: null,
            });
          } catch {
            await openedRepositories?.close().catch(() => undefined);

            if (
              generation === loadGenerationRef.current &&
              mountedRef.current
            ) {
              repositoriesRef.current = null;
              setState({
                status: "error",
                session: null,
                errorMessage: runtimeUnavailableMessage,
              });
            }

            throw new TokenlyRuntimeUnavailableError();
          }
        });

      reloadQueueRef.current = queuedReload.catch(() => undefined);
      return queuedReload;
    },
    [getSessionStore],
  );

  useEffect(() => {
    mountedRef.current = true;
    void reloadRuntime().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      const repositories = repositoriesRef.current;
      repositoriesRef.current = null;
      void repositories?.close();
    };
  }, [reloadRuntime]);

  const persistResolvedSession = useCallback(
    (session: AuthenticatedSessionReadModel): AuthenticatedSessionReadModel => {
      getSessionStore().saveAccountId(session.account.id);
      setState((current) => ({
        ...current,
        session,
        errorMessage: null,
      }));
      return session;
    },
    [getSessionStore],
  );

  const enterAccount = useCallback(
    async (
      input: AccountEntryInput,
    ): Promise<AuthenticatedSessionReadModel> => {
      if (repositoriesRef.current === null) {
        throw new TokenlyRuntimeUnavailableError();
      }

      const session = await createAccountEntryService().enter(input);
      return persistResolvedSession(session);
    },
    [persistResolvedSession],
  );

  const listDevelopmentAccounts = useCallback(async (): Promise<
    readonly DevelopmentAccountReadModel[]
  > => {
    const repositories = repositoriesRef.current;
    if (repositories === null) {
      throw new TokenlyRuntimeUnavailableError();
    }

    return createConfiguredDevelopmentAccountQuery(
      repositories.accounts,
    ).listActiveAccounts();
  }, []);

  const switchDevelopmentAccount = useCallback(
    async (accountId: string): Promise<AuthenticatedSessionReadModel> => {
      if (repositoriesRef.current === null) {
        throw new TokenlyRuntimeUnavailableError();
      }

      const session =
        await createAccountEntryService().enterDevelopmentAccount(accountId);
      return persistResolvedSession(session);
    },
    [persistResolvedSession],
  );

  const refreshSession =
    useCallback(async (): Promise<AuthenticatedSessionReadModel | null> => {
      const repositories = repositoriesRef.current;
      if (repositories === null) {
        throw new TokenlyRuntimeUnavailableError();
      }

      const session = await resolveStoredSession(
        getSessionStore(),
        repositories,
        true,
      );
      setState((current) => ({ ...current, session }));
      return session;
    }, [getSessionStore]);

  const signOut = useCallback((): void => {
    getSessionStore().clear();
    setState((current) => ({ ...current, session: null }));
  }, [getSessionStore]);

  const value = useMemo<TokenlyRuntimeValue>(
    () => ({
      ...state,
      enterAccount,
      listDevelopmentAccounts,
      switchDevelopmentAccount,
      refreshSession,
      signOut,
      reloadRuntime,
    }),
    [
      enterAccount,
      listDevelopmentAccounts,
      refreshSession,
      reloadRuntime,
      signOut,
      state,
      switchDevelopmentAccount,
    ],
  );

  return (
    <TokenlyRuntimeContext.Provider value={value}>
      {children}
    </TokenlyRuntimeContext.Provider>
  );
}

export function useTokenlyRuntime(): TokenlyRuntimeValue {
  const runtime = useContext(TokenlyRuntimeContext);

  if (runtime === null) {
    throw new TokenlyRuntimeUnavailableError();
  }

  return runtime;
}
