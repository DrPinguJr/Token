import { NextResponse } from "next/server";
import { z } from "zod";

import {
  refreshSupabaseClaimQr,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ customerId: z.string().uuid() }).strict();

export async function POST(
  _request: Request,
  context: { readonly params: Promise<{ readonly customerId: string }> },
) {
  try {
    requirePrototypeRole(_request, "administrator");
    const { customerId } = paramsSchema.parse(await context.params);
    return NextResponse.json({
      tokener: await refreshSupabaseClaimQr(customerId),
    });
  } catch (error: unknown) {
    if (error instanceof PrototypeSessionRoleError) {
      return NextResponse.json(
        { code: error.code, message: "Admin login is required." },
        { status: 401 },
      );
    }

    const code =
      error instanceof SupabaseTokenlyAccessError
        ? error.code
        : "TOKENLY_SUPABASE_WRITE_FAILED";
    return NextResponse.json(
      { code, message: "Claim QR could not be refreshed." },
      { status: 400 },
    );
  }
}
