import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseServerEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
  })
  .strict();

export class SupabaseServerConfigurationError extends Error {
  public readonly code = "SUPABASE_SERVER_CONFIGURATION_ERROR";

  public constructor() {
    super("Supabase server configuration is unavailable.");
    this.name = "SupabaseServerConfigurationError";
  }
}

export function createSupabaseServerClient(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseClient {
  const parsedEnvironment = supabaseServerEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: environment.SUPABASE_SECRET_KEY,
  });

  if (!parsedEnvironment.success) {
    throw new SupabaseServerConfigurationError();
  }

  return createClient(
    parsedEnvironment.data.NEXT_PUBLIC_SUPABASE_URL,
    parsedEnvironment.data.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
