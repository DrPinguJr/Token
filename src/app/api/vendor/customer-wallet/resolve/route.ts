import { NextResponse } from "next/server";
import { z } from "zod";

import {
  resolveSupabaseCustomerWallet,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

const resolveRequestSchema = z.object({ value: z.string().min(1) }).strict();

export async function POST(request: Request) {
  try {
    requirePrototypeRole(request, "vendor");
    const { value } = resolveRequestSchema.parse(await request.json());
    return NextResponse.json(await resolveSupabaseCustomerWallet(value));
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
        : "CUSTOMER_ACCESS_DENIED";

    return NextResponse.json(
      { code, message: "Customer wallet QR could not be resolved." },
      { status: 400 },
    );
  }
}
