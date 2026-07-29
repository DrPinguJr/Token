import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSupabaseCreditIssuance,
  supabaseCreditIssuanceSchema,
  SupabaseTokenlyAccessError,
} from "@/config/supabase-tokenly-access";
import {
  PrototypeSessionRoleError,
  requirePrototypeRole,
} from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ customerId: z.string().uuid() }).strict();

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly customerId: string }> },
) {
  try {
    requirePrototypeRole(request, "administrator");
    const { customerId } = paramsSchema.parse(await context.params);
    const formData = await request.formData();
    const evidence = formData.get("evidence");
    if (!(evidence instanceof File)) {
      throw new SupabaseTokenlyAccessError(
        "INVALID_INPUT",
        "Payment evidence is required.",
      );
    }

    const input = supabaseCreditIssuanceSchema.parse({
      amountCents: formData.get("amountCents"),
      customerId,
      paymentMethod: formData.get("paymentMethod"),
    });

    return NextResponse.json({
      tokener: await createSupabaseCreditIssuance({ ...input, evidence }),
    });
  } catch (error: unknown) {
    if (error instanceof PrototypeSessionRoleError) {
      return NextResponse.json(
        { code: error.code, message: "Admin login is required." },
        { status: 401 },
      );
    }

    if (error instanceof SupabaseTokenlyAccessError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        code: "INVALID_INPUT",
        message: "Token adjustment could not be saved.",
      },
      { status: 400 },
    );
  }
}
