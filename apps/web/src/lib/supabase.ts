import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublishableKey, requireSupabaseUrl } from "./public-config";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  client = createClient(requireSupabaseUrl(), requireSupabasePublishableKey(), {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
