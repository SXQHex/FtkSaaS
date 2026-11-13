import { v7 as uuidv7 } from "uuid";
import { getSupabaseClient } from "../../lib/supabase";
import { getBackend } from "../../lib/backend";

export async function readFactors() {
  const { data, error } = await getSupabaseClient().auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

export function readSecurityHistory(cursor?: string) {
  return getBackend().call("account_security_history_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    ...(cursor ? { cursor } : {}),
  });
}

export async function enrollTotp() {
  const { data, error } = await getSupabaseClient().auth.mfa.enroll({ factorType: "totp" });
  if (error) throw error;
  if (data.type !== "totp") throw new Error("TOTP_REQUIRED");
  return data;
}

export async function confirmTotpSetup(factorId: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("MFA_CODE_INVALID");
  const auth = getSupabaseClient().auth;
  const verification = await auth.mfa.challengeAndVerify({ factorId, code });
  if (verification.error) throw verification.error;
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.currentLevel !== "aal2") throw new Error("MFA_REQUIRED");
}

export async function removeTotpFactor(factorId: string) {
  const { error } = await getSupabaseClient().auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
