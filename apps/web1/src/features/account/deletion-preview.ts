import { v7 as uuidv7 } from "uuid";
import { createBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";

export async function readDeletionPreview(accountId: string) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const token = data.session.access_token;
  const backend = createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => token,
  });
  const account = await backend.call("account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
  const preview = await backend.call("account_delete_preview_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  // Expose display data only. Apply tokens/proofs never enter UI caches.
  return {
    blockers: preview.blockers.map((blocker) => blocker.code),
    effects: preview.effects.map((effect) => ({
      entityType: effect.entity.type,
      action: effect.action,
      quantity: effect.quantity,
    })),
    impact: preview.lifecycle_impact,
    expiresAt: preview.expires_at,
  };
}
