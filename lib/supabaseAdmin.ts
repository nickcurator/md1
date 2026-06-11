import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client — SERVER ONLY. It bypasses Row Level
// Security, so it must never be imported into a client component or
// shipped to the browser. The only caller is the Polar webhook handler,
// which needs to write billing columns on `profiles` that RLS otherwise
// forbids the user from touching (so a user can't self-grant premium).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
