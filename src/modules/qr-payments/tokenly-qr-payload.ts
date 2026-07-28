import { z } from "zod";

import { publicCodeSchema } from "@/shared/validation";

const tokenlyQrPayloadPrefix = "tokenly://qr/";
const tokenlyQrPayloadMaximumLength = 200;

export const tokenlyQrPayloadVersionSchema = z.literal(1);
export const tokenlyQrEntityKindSchema = z.enum(["customer", "vendor"]);

export const customerQrPublicCodeSchema = publicCodeSchema.regex(
  /^cus_[A-Za-z0-9_-]+$/,
);
export const vendorQrPublicCodeSchema = publicCodeSchema.regex(
  /^vnd_[A-Za-z0-9_-]+$/,
);

const customerQrPayloadInputSchema = z
  .object({
    version: tokenlyQrPayloadVersionSchema,
    kind: z.literal("customer"),
    publicCode: customerQrPublicCodeSchema,
  })
  .strict();

const vendorQrPayloadInputSchema = z
  .object({
    version: tokenlyQrPayloadVersionSchema,
    kind: z.literal("vendor"),
    publicCode: vendorQrPublicCodeSchema,
  })
  .strict();

export const tokenlyQrPayloadSchema = z.discriminatedUnion("kind", [
  customerQrPayloadInputSchema,
  vendorQrPayloadInputSchema,
]);

export type TokenlyQrPayload = Readonly<
  z.infer<typeof tokenlyQrPayloadSchema>
>;
export type TokenlyQrEntityKind = z.infer<typeof tokenlyQrEntityKindSchema>;

export class InvalidTokenlyQrPayloadError extends Error {
  public readonly code = "INVALID_TOKENLY_QR_PAYLOAD";

  public constructor() {
    super("The value is not a supported Tokenly QR payload.");
    this.name = "InvalidTokenlyQrPayloadError";
  }
}

export function buildTokenlyQrPayload(input: unknown): string {
  const parsed = tokenlyQrPayloadSchema.safeParse(input);

  if (!parsed.success) {
    throw new InvalidTokenlyQrPayloadError();
  }

  return `${tokenlyQrPayloadPrefix}v${parsed.data.version}/${parsed.data.kind}/${parsed.data.publicCode}`;
}

export function parseTokenlyQrPayload(input: unknown): TokenlyQrPayload {
  const rawPayload = z
    .string()
    .min(1)
    .max(tokenlyQrPayloadMaximumLength)
    .safeParse(input);

  if (
    !rawPayload.success ||
    rawPayload.data !== rawPayload.data.trim() ||
    !rawPayload.data.startsWith(tokenlyQrPayloadPrefix)
  ) {
    throw new InvalidTokenlyQrPayloadError();
  }

  let url: URL;
  try {
    url = new URL(rawPayload.data);
  } catch {
    throw new InvalidTokenlyQrPayloadError();
  }

  if (
    url.protocol !== "tokenly:" ||
    url.hostname !== "qr" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new InvalidTokenlyQrPayloadError();
  }

  const pathMatch =
    /^\/v(1)\/(customer|vendor)\/([A-Za-z0-9_-]+)$/.exec(url.pathname);

  if (pathMatch === null) {
    throw new InvalidTokenlyQrPayloadError();
  }

  const [, version, kind, publicCode] = pathMatch;
  const candidate = tokenlyQrPayloadSchema.safeParse({
    version: Number(version),
    kind,
    publicCode,
  });

  if (
    !candidate.success ||
    buildTokenlyQrPayload(candidate.data) !== rawPayload.data
  ) {
    throw new InvalidTokenlyQrPayloadError();
  }

  return Object.freeze(candidate.data);
}
