import { createClient } from "@supabase/supabase-js";

/**
 * Creates a privileged Supabase client with the service-role key.
 * Strictly used SERVER-SIDE ONLY (e.g., RSS synchronization worker).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase URL or Service Role Key in server environment variables"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
