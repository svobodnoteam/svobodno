import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }

  return value;
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/** Публичный клиент: чтение через RLS (политики read_*). */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

let adminClient: SupabaseClient | null = null;

/** Серверный клиент: запись броней в обход RLS (service_role). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}
