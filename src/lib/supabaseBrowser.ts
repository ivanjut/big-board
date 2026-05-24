"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Anonymous client for the browser. Used only for Realtime subscriptions to the
// public `picks` table; all writes go through the API routes.
let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { realtime: { params: { eventsPerSecond: 5 } } },
    );
  }
  return client;
}
