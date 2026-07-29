import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSupabaseVendorCharge,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

const chargeRequestSchema = z
  .object({
    customerId: z.string().uuid(),
    direction: z.enum(["add", "deduct"]).default("deduct"),
    tokenAmount: z.coerce.number().positive().multipleOf(0.01),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const session = requirePrototypeRole(request, "vendor");
    const input = chargeRequestSchema.parse(await request.json());

    return NextResponse.json(
      await createSupabaseVendorCharge({
        ...input,
        vendorUsername: session.username,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof PrototypeSessionRoleError) {
      return NextResponse.json(
        { code: error.code, message: "Vendor login is required." },
        { status: 401 },
      );
    }

    const code =
      error instanceof SupabaseTokenlyAccessError
        ? error.code
        : "TOKENLY_SUPABASE_WRITE_FAILED";
    const message =
      code === "TOKEN_CHARGE_INSUFFICIENT_BALANCE"
        ? "Customer wallet does not have enough tokens."
        : code === "TOKEN_RETURN_INSUFFICIENT_VENDOR_BALANCE"
          ? "Vendor wallet does not have enough tokens to return."
          : "Customer wallet could not be charged.";

    return NextResponse.json({ code, message }, { status: 400 });
  }
}
