import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";

export function recoveryCallbackUrl() {
  const origin = import.meta.env.VITE_APP_ORIGIN?.trim();
  if (!origin) throw new Error("APP_ORIGIN_REQUIRED");
  return `${origin}/auth/callback?next=/reset-password`;
}

export async function requestPasswordReset(email: string) {
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo: recoveryCallbackUrl(),
  });
  if (error) throw error;
}

async function nativeSessionKey(session: Session) {
  const { data, error } = await getSupabaseClient().auth.getClaims(session.access_token);
  if (error) throw error;
  const sessionId = data?.claims.session_id;
  if (data?.claims.sub !== session.user.id || typeof sessionId !== "string" || !sessionId)
    throw new Error("RECOVERY_REQUIRED");
  return `${session.user.id}:${sessionId}`;
}

export async function rememberRecoverySession(session: Session) {
  sessionStorage.setItem("ftk-recovery-account", await nativeSessionKey(session));
}

export async function hasRecoverySession() {
  const marker = sessionStorage.getItem("ftk-recovery-account");
  if (!marker) return false;
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  const matches = data.session && marker === (await nativeSessionKey(data.session));
  if (!matches) sessionStorage.removeItem("ftk-recovery-account");
  return Boolean(matches);
}

export async function requireRecoverySession() {
  if (!(await hasRecoverySession())) throw new Error("RECOVERY_REQUIRED");
  // The marker gates this UI; native Auth enforces the actual password/session policy.
}

export async function saveRecoveredPassword(password: string) {
  await requireRecoverySession();
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
  sessionStorage.removeItem("ftk-recovery-account");
}
