import { NextResponse } from "next/server";
import { z } from "zod";

import {
  regenerateSupabaseWalletQr,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";

export const dynamic = "force-dynamic";

const paramsSchema = z
  .object({ privateAccessCode: z.string().min(6).max(128) })
  .strict();

export async function POST(
  _request: Request,
  context: { readonly params: Promise<{ readonly privateAccessCode: string }> },
) {
  try {
    const { privateAccessCode } = paramsSchema.parse(await context.params);
    return NextResponse.json(
      await regenerateSupabaseWalletQr(privateAccessCode),
    );
  } catch (error: unknown) {
    const code =
      error instanceof SupabaseTokenlyAccessError
        ? error.code
        : "CUSTOMER_ACCESS_DENIED";
    return NextResponse.json(
      { code, message: "Wallet QR could not be regenerated." },
      { status: 400 },
    );
  }
}
