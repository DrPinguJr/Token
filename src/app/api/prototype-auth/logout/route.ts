import { NextResponse } from "next/server";

import { createPrototypeSessionClearCookie } from "@/config/prototype-session-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "set-cookie": createPrototypeSessionClearCookie() } },
  );
}
