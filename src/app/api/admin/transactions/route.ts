import { NextResponse } from "next/server";

import { getSupabaseAdminTransactionOverview } from "@/config/supabase-tokenly-access";
import { SupabaseServerConfigurationError } from "@/config/supabase-server-client";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requirePrototypeRole(request, "administrator");
    return NextResponse.json(await getSupabaseAdminTransactionOverview());
  } catch (error: unknown) {
    if (error instanceof PrototypeSessionRoleError) {
      return NextResponse.json(
        {
          code: error.code,
          message: "Admin login is required.",
        },
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
      {
        code: "TOKENLY_SUPABASE_WRITE_FAILED",
        message: "Supabase transaction activity could not load.",
      },
      { status: 500 },
    );
  }
}
