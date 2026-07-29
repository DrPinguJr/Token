import type {
  AdminTokenerAccessSummary,
  ClaimedPrivateAccountReadModel,
  PrivateAccountReadModel,
} from "@/modules/customer-access";
import type { AdminTransactionOverview } from "@/modules/admin-application";

interface TokenlyApiErrorBody {
  readonly code?: string;
  readonly message?: string;
}

export class TokenlyApiError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "TokenlyApiError";
  }
}

export async function loadRemoteAdminTransactions(): Promise<AdminTransactionOverview> {
  return readJson<AdminTransactionOverview>(
    await fetch("/api/admin/transactions", { cache: "no-store" }),
  );
}

async function readJson<ResponseBody extends object>(
  response: Response,
): Promise<ResponseBody> {
  const body = (await response.json()) as ResponseBody | TokenlyApiErrorBody;

  if (!response.ok) {
    throw new TokenlyApiError(
      "code" in body && typeof body.code === "string"
        ? body.code
        : "TOKENLY_API_ERROR",
    );
  }

  return body as ResponseBody;
}

export async function loadRemoteTokeners(): Promise<
  readonly AdminTokenerAccessSummary[]
> {
  const body = await readJson<{
    readonly tokeners: readonly AdminTokenerAccessSummary[];
  }>(await fetch("/api/admin/tokeners", { cache: "no-store" }));

  return body.tokeners;
}

export async function createRemoteTokener(input: {
  readonly displayName: string;
  readonly nric: string;
}): Promise<void> {
  await readJson(
    await fetch("/api/admin/tokeners", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
}

export async function refreshRemoteClaimQr(customerId: string): Promise<void> {
  await readJson(
    await fetch(`/api/admin/tokeners/${encodeURIComponent(customerId)}/claim`, {
      method: "POST",
    }),
  );
}

export async function addRemoteTokenerCredits(input: {
  readonly amountCents: number;
  readonly customerId: string;
  readonly evidence: File;
  readonly paymentMethod: "cash" | "paynow";
}): Promise<void> {
  const body = new FormData();
  body.set("amountCents", String(input.amountCents));
  body.set("evidence", input.evidence);
  body.set("paymentMethod", input.paymentMethod);

  await readJson(
    await fetch(
      `/api/admin/tokeners/${encodeURIComponent(input.customerId)}/tokens`,
      {
        body,
        method: "POST",
      },
    ),
  );
}

export async function claimRemoteTokener(
  claimCode: string,
): Promise<ClaimedPrivateAccountReadModel> {
  return readJson<ClaimedPrivateAccountReadModel>(
    await fetch("/api/customer-access/claim", {
      body: JSON.stringify({ claimCode }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
}

export async function loadRemotePrivateAccount(
  privateAccessCode: string,
): Promise<PrivateAccountReadModel> {
  return readJson<PrivateAccountReadModel>(
    await fetch(
      `/api/customer-access/private-account/${encodeURIComponent(
        privateAccessCode,
      )}`,
      { cache: "no-store" },
    ),
  );
}

export async function regenerateRemoteWalletQr(
  privateAccessCode: string,
): Promise<void> {
  await readJson(
    await fetch(
      `/api/customer-access/private-account/${encodeURIComponent(
        privateAccessCode,
      )}/regenerate-wallet-qr`,
      { method: "POST" },
    ),
  );
}

export async function establishPrototypeSession(input: {
  readonly password: string;
  readonly username: string;
}): Promise<void> {
  await readJson(
    await fetch("/api/prototype-auth/login", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );
}

export async function clearPrototypeSession(): Promise<void> {
  await readJson(
    await fetch("/api/prototype-auth/logout", {
      method: "POST",
    }),
  );
}
