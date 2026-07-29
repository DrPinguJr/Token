import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { prototypeOperationalCredentials } from "@/modules/authentication/prototype-operational-credentials";

const cookieName = "tokenly_prototype_session";
type PrototypeRole = (typeof prototypeOperationalCredentials)[number]["role"];

export interface PrototypeSession {
  readonly role: PrototypeRole;
  readonly username: string;
}

export class PrototypeSessionRoleError extends Error {
  public readonly code = "PROTOTYPE_SESSION_ROLE_UNAVAILABLE";

  public constructor() {
    super("Prototype session role is unavailable.");
    this.name = "PrototypeSessionRoleError";
  }
}

const cookieValueSchema = z
  .object({
    role: z.enum(["administrator", "vendor"]),
    signature: z.string().min(1),
    username: z.string().min(1),
  })
  .strict();

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (secret === undefined || secret.length === 0) {
    throw new Error("Prototype session signing secret is unavailable.");
  }

  return secret;
}

function signSession(input: {
  readonly role: PrototypeRole;
  readonly username: string;
}): string {
  return createHmac("sha256", getSigningSecret())
    .update(`${input.role}:${input.username}`)
    .digest("hex");
}

function encodeCookie(session: PrototypeSession): string {
  return Buffer.from(
    JSON.stringify({ ...session, signature: signSession(session) }),
    "utf8",
  ).toString("base64url");
}

function getSecureCookieAttribute(): string {
  return process.env.NODE_ENV === "development" ? "" : "; Secure";
}

function decodeCookie(value: string): PrototypeSession | null {
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const parsed = cookieValueSchema.safeParse(parsedValue);
  if (!parsed.success) {
    return null;
  }

  const expected = Buffer.from(signSession(parsed.data), "utf8");
  const actual = Buffer.from(parsed.data.signature, "utf8");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  return {
    role: parsed.data.role,
    username: parsed.data.username,
  };
}

function readCookieValue(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader === null) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const matchingCookie = cookies.find((cookie) =>
    cookie.startsWith(`${cookieName}=`),
  );

  return matchingCookie?.slice(cookieName.length + 1) ?? null;
}

export function createPrototypeSessionCookie(input: {
  readonly password: string;
  readonly username: string;
}): string | null {
  const credential =
    prototypeOperationalCredentials.find(
      (candidate) =>
        candidate.username === input.username &&
        candidate.password === input.password,
    ) ?? null;

  if (credential === null) {
    return null;
  }

  return `${cookieName}=${encodeCookie({
    role: credential.role,
    username: credential.username,
  })}; Path=/; HttpOnly; SameSite=Lax${getSecureCookieAttribute()}; Max-Age=28800`;
}

export function createPrototypeSessionClearCookie(): string {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax${getSecureCookieAttribute()}; Max-Age=0`;
}

export function requirePrototypeRole(
  request: Request,
  role: PrototypeRole,
): PrototypeSession {
  const cookieValue = readCookieValue(request);
  const session = cookieValue === null ? null : decodeCookie(cookieValue);

  if (session?.role !== role) {
    throw new PrototypeSessionRoleError();
  }

  return session;
}
