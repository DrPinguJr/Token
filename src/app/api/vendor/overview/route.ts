import { NextResponse } from "next/server";

import { getSupabaseVendorOverview } from "@/config/supabase-tokenly-access";
import { SupabaseServerConfigurationError } from "@/config/supabase-server-client";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requirePrototypeRole(request, "vendor");
    return NextResponse.json(await getSupabaseVendorOverview(session.username));
  } catch (error: unknown) {
    if (error instanceof PrototypeSessionRoleError) {
      return NextResponse.json(
        { code: error.code, message: "Vendor login is required." },
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
        message: "Vendor overview could not load.",
      },
      { status: 500 },
    );
  }
}
