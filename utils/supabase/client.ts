import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for browser-side Client Components.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase public configuration in environment variables");
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
