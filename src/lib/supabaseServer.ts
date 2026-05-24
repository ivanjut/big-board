import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only use (API routes). Bypasses RLS, so it
// must never be imported into client components.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
