import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/config/supabase-server-client";

const tokenlySupabaseTables = {
  events: "id",
  account_profiles: "id",
  event_role_memberships: "id",
  event_settings: "event_id",
  wallets: "id",
  customers: "id",
  vendors: "id",
  products: "id",
  evidence: "id",
  token_issuances: "id",
  orders: "id",
  order_items: "id",
  refunds: "id",
  settlements: "id",
  ledger_entries: "id",
  audit_logs: "id",
} as const;

type TokenlySupabaseTable = keyof typeof tokenlySupabaseTables;

const tokenlySupabaseTableEntries = Object.entries(tokenlySupabaseTables) as [
  TokenlySupabaseTable,
  (typeof tokenlySupabaseTables)[TokenlySupabaseTable],
][];

type SupabaseTableHealth = Readonly<{
  count: number | null;
  error: string | null;
  table: TokenlySupabaseTable;
}>;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const tables = await Promise.all(
      tokenlySupabaseTableEntries.map(
        async ([table, column]): Promise<SupabaseTableHealth> => {
          const { count, error } = await supabase
            .from(table)
            .select(column, { count: "exact", head: true });

          return {
            table,
            count: count ?? null,
            error: error?.message ?? null,
          };
        },
      ),
    );

    const isHealthy = tables.every((table) => table.error === null);

    return NextResponse.json(
      {
        status: isHealthy ? "ok" : "error",
        checkedAt: new Date().toISOString(),
        tables,
      },
      { status: isHealthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        checkedAt: new Date().toISOString(),
        message: "Supabase server configuration or database access failed.",
      },
      { status: 503 },
    );
  }
}
