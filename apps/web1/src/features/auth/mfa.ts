import { getSupabaseClient } from "../../lib/supabase";
import { readAccount } from "../../lib/account";
import { hasDeletionReceipt } from "../account/deletion";
import {
  hasPendingPasswordReplacement,
  retirePreviousPasswordSession,
} from "../account/fresh-session";
import { hasRecoverySession } from "./password-recovery";

export async function readTotpFactors() {
  const { data, error } = await getSupabaseClient().auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.filter((factor) => factor.status === "verified");
}

export async function verifyTotp(factorId: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("MFA_CODE_INVALID");
  const factors = await readTotpFactors();
  if (!factors.some((factor) => factor.id === factorId)) throw new Error("MFA_FACTOR_REQUIRED");
  const { error } = await getSupabaseClient().auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
  await requireAal2();
}

async function requireAal2(accessToken?: string) {
  const { data, error } =
    await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
  if (error) throw error;
  if (data.currentLevel !== "aal2") throw new Error("MFA_REQUIRED");
}

export async function continueAfterMfa() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("MFA_REQUIRED");
  await requireAal2(
    hasPendingPasswordReplacement(data.session) ? data.session.access_token : undefined,
  );
  if (hasDeletionReceipt(data.session.user.id) && !(await hasRecoverySession()))
    return "/account/deletion" as const;
  await readAccount();
  await retirePreviousPasswordSession(data.session);
  return (await hasRecoverySession()) ? "/reset-password" : "/account";
}
