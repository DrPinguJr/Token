import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getSupabaseTokener,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";
import { SupabaseServerConfigurationError } from "@/config/supabase-server-client";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ customerId: z.string().uuid() }).strict();

function errorResponse(error: unknown) {
  if (error instanceof SupabaseTokenlyAccessError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: 400 },
    );
  }

  if (error instanceof PrototypeSessionRoleError) {
    return NextResponse.json(
      { code: error.code, message: "Admin login is required." },
      { status: 401 },
    );
  }

  if (error instanceof SupabaseServerConfigurationError) {
    return NextResponse.json(
      {
        code: error.code,
        message: "Supabase server configuration is unavailable.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { code: "TOKENLY_SUPABASE_WRITE_FAILED", message: "Request failed." },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly customerId: string }> },
) {
  try {
    requirePrototypeRole(request, "administrator");
    const { customerId } = paramsSchema.parse(await context.params);

    return NextResponse.json({ tokener: await getSupabaseTokener(customerId) });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
