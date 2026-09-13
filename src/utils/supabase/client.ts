import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  browserClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
