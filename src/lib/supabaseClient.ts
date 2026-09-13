import { createClient } from "@supabase/supabase-js";

// Публичные переменные из .env.local — доступны в браузере благодаря префиксу NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Не заданы NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Один клиент на всё приложение: импортируем его там, где нужны запросы к Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
