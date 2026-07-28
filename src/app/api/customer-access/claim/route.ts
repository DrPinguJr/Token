import { NextResponse } from "next/server";
import { z } from "zod";

import {
  claimSupabaseTokener,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";

export const dynamic = "force-dynamic";

const claimRequestSchema = z.object({ claimCode: z.string().min(1) }).strict();

export async function POST(request: Request) {
  try {
    const { claimCode } = claimRequestSchema.parse(await request.json());
    return NextResponse.json(await claimSupabaseTokener(claimCode));
  } catch (error: unknown) {
    const code =
      error instanceof SupabaseTokenlyAccessError
        ? error.code
        : "CUSTOMER_ACCESS_DENIED";
    return NextResponse.json(
      { code, message: "Claim QR is unavailable." },
      { status: code === "CLAIM_QR_ALREADY_USED" ? 409 : 400 },
    );
  }
}
