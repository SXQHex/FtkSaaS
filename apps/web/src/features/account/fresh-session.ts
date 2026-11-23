import { v7 as uuidv7 } from "uuid";
import { nativeSessionId } from "../auth/native-session-id";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import { BackendError, getBackend } from "../../lib/backend";
import { revokeSession } from "./sessions";

// Share the exact pair across browser tabs and the MFA redirect without storing either token.
const replacementKey = "ftk.web1.password-session-replacement";
const replacementSchema = z.object({
  actor: z.uuid(),
  previous: z.uuid(),
  replacement: z.uuid(),
  operationKey: z.uuid(),
});
function pendingReplacement() {
  try {
    return replacementSchema.parse(JSON.parse(localStorage.getItem(replacementKey) ?? "null"));
  } catch {
    return undefined;
  }
}

function replacementFor(session: Session) {
  const pending = pendingReplacement();
  if (
    pending &&
    pending.actor === session.user?.id &&
    pending.replacement !== pending.previous &&
    pending.replacement === nativeSessionId(session)
  )
    return pending;
}

export function hasPendingPasswordReplacement(session: Session) {
  return Boolean(replacementFor(session));
}

function withReplacementLock<T>(action: () => Promise<T>) {
  return navigator.locks ? navigator.locks.request(replacementKey, action) : action();
}

export async function retirePreviousPasswordSession(session: Session) {
  if (hasPendingPasswordReplacement(session))
    await withReplacementLock(() => retirePendingPasswordSession(session));
}

async function retirePendingPasswordSession(session: Session) {
  const pending = replacementFor(session);
  if (!pending) return;
  try {
    await revokeSession(pending.previous, pending.operationKey, session.access_token);
  } catch (error) {
    if (!(error instanceof BackendError && error.code === "NOT_FOUND")) throw error;
  }
  if (pendingReplacement()?.operationKey === pending.operationKey)
    localStorage.removeItem(replacementKey);
}

export function freshPasswordSession(password: string) {
  return withReplacementLock(() => replacePasswordSession(password));
}

async function replacePasswordSession(password: string) {
  const auth = getSupabaseClient().auth;
  const current = await auth.getUser();
  if (current.error) throw current.error;
  const user = current.data.user;
  if (!user?.email) throw new Error("AUTH_REQUIRED");
  const before = await auth.getSession();
  if (before.error) throw before.error;
  const existing = before.data.session;
  const previous = existing?.user.id === user.id ? nativeSessionId(existing) : undefined;
  if (!existing || !previous) throw new Error("AUTH_REQUIRED");
  if (replacementFor(existing)) {
    await requirePasswordSessionAssurance(existing);
    await retirePendingPasswordSession(existing);
  }
  const { data, error } = await auth.signInWithPassword({ email: user.email, password });
  if (error) throw error;
  if (!data.session || data.user?.id !== user.id) throw new Error("AUTH_REQUIRED");
  const replacement = nativeSessionId(data.session);
  if (!replacement || data.session.user.id !== user.id) throw new Error("AUTH_REQUIRED");
  if (replacement !== previous)
    localStorage.setItem(
      replacementKey,
      JSON.stringify({ actor: user.id, previous, replacement, operationKey: uuidv7() }),
    );
}

export class MfaRequiredError extends Error {
  constructor() {
    super("MFA_REQUIRED");
  }
}

async function requirePasswordSessionAssurance(session: Session) {
  const assurance = await getSupabaseClient().auth.mfa.getAuthenticatorAssuranceLevel(
    session.access_token,
  );
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    throw new MfaRequiredError();
}

export async function prepareOthersIntent() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  await requirePasswordSessionAssurance(data.session);
  await retirePreviousPasswordSession(data.session);
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
