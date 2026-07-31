import { NextResponse } from "next/server";

import {
  createSupabaseTokener,
  createSupabaseTokenerSchema,
  listSupabaseTokeners,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";
import { SupabaseServerConfigurationError } from "@/config/supabase-server-client";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof SupabaseTokenlyAccessError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.code === "DUPLICATE_MOBILE_NUMBER" ? 409 : 400 },
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

export async function GET(request: Request) {
  try {
    requirePrototypeRole(request, "administrator");
    return NextResponse.json({ tokeners: await listSupabaseTokeners() });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requirePrototypeRole(request, "administrator");
    const input = createSupabaseTokenerSchema.parse(await request.json());
    return NextResponse.json(
      { tokener: await createSupabaseTokener(input) },
      { status: 201 },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
