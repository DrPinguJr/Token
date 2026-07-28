import { NextResponse } from "next/server";
import { z } from "zod";

import { createPrototypeSessionCookie } from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

const loginSchema = z
  .object({
    password: z.string().min(1),
    username: z.string().min(1),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ code: "LOGIN_FAILED" }, { status: 400 });
  }

  const cookie = createPrototypeSessionCookie(parsed.data);
  if (cookie === null) {
    return NextResponse.json({ code: "LOGIN_FAILED" }, { status: 401 });
  }

  return NextResponse.json(
    { status: "ok" },
    { headers: { "set-cookie": cookie } },
  );
}
