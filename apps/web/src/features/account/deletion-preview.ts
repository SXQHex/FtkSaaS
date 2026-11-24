import { v7 as uuidv7 } from "uuid";
import { getBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import { prepareDeletion } from "./deletion";

export async function readDeletionPreview(
  accountId: string,
  onPrepared?: (confirm: () => Promise<void>) => void,
) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const token = data.session.access_token;
  const backend = getBackend(token);
  const account = await backend.call("account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
  const preview = await backend.call("account_delete_preview_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (onPrepared && preview.blockers.length === 0)
    onPrepared(prepareDeletion(data.session.user.id, accountId, preview));
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
