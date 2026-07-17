import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!url || !key) throw new Error("Supabase environment variables are not configured.");
  client ??= createBrowserClient(url, key);
  return client;
}
