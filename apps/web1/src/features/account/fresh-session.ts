import { v7 as uuidv7 } from "uuid";
import { getSupabaseClient } from "../../lib/supabase";
import { getBackend } from "../../lib/backend";

export async function freshPasswordSession(password: string) {
  const auth = getSupabaseClient().auth;
  const current = await auth.getUser();
  if (current.error) throw current.error;
  const user = current.data.user;
  if (!user?.email) throw new Error("AUTH_REQUIRED");
  const { data, error } = await auth.signInWithPassword({ email: user.email, password });
  if (error) throw error;
  if (!data.session || data.user?.id !== user.id) throw new Error("AUTH_REQUIRED");
}

export class MfaRequiredError extends Error {
  constructor() {
    super("MFA_REQUIRED");
  }
}

export async function prepareOthersIntent() {
  const auth = getSupabaseClient().auth;
  const { data, error } = await auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel(data.session.access_token);
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    throw new MfaRequiredError();
  // Proof stays only in the open action's memory. The backend verifies freshness and same-session ownership.
  return { proof: data.session.access_token, operationKey: uuidv7() };
}

export function revokeOthers(intent: Awaited<ReturnType<typeof prepareOthersIntent>>) {
  return getBackend().call("account_sessions_revoke_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    mode: "others",
    reauth: intent.proof,
    operation_key: intent.operationKey,
  });
}
