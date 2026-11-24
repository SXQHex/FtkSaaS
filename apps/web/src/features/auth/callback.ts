import type { QueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import { queryClient } from "../../lib/query-client";
import { hasDeletionReceipt } from "../account/deletion";
import { accountQuery } from "./account-query";
import { sameNativeSession } from "./native-session-id";
import { rememberRecoverySession, requireRecoverySession } from "./password-recovery";
import { takeGoogleCalendarReturn } from "./calendar-session-return";

export function safeNext(next: unknown) {
  return next === "/reset-password" ? "/reset-password" : "/account";
}

type CallbackInput = { code?: string; flowId?: string; providerError?: boolean; next: string };
let captured: CallbackInput | undefined;

// Native redirects reload the SPA. Capture/scrub before createRouter installs history listeners.
export function captureAuthCallback() {
  if (window.location.pathname !== "/auth/callback") return;
  const search = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  captured = {
    code: search.get("code") ?? undefined,
    flowId: search.get("sb_flow_id") ?? undefined,
    providerError: ["error", "error_code", "error_description"].some(
      (field) => search.has(field) || fragment.has(field),
    ),
    next: safeNext(search.get("next")),
  };
  window.history.replaceState(window.history.state, "", "/auth/callback");
}

export function capturedCallback() {
  return captured ?? { next: "/account" };
}

let exchange: { code: string; result: Promise<string> } | undefined;

async function verifyCallbackSession(expected: Session) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session || !sameNativeSession(expected, data.session))
    throw new Error("ACCOUNT_CHANGED");
}

export function completeCallback(
  input: CallbackInput,
  queries: QueryClient = queryClient,
): Promise<string> {
  if (input.providerError || !input.code) {
    takeGoogleCalendarReturn();
    return Promise.reject(new Error("AUTH_CALLBACK_INVALID"));
  }
  if (exchange?.code === input.code) return exchange.result;
  const code = input.code;
  const calendarReturn = takeGoogleCalendarReturn();
  const result = (async () => {
    const auth = getSupabaseClient().auth;
    let recovery = false;
    const { data: observer } = auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recovery = true;
    });
    const response = await auth
      .exchangeCodeForSession(code, input.flowId ? { flowId: input.flowId } : undefined)
      .finally(() => observer.subscription.unsubscribe());
    const { data, error } = response;
    if (error) throw error;
    if (!data.session) throw new Error("AUTH_REQUIRED");
    // A completed native exchange starts a new private Query lifetime, even
    // when this browser signs in as the same user again.
    queries.clear();
    if (recovery) await rememberRecoverySession(data.session);
    const next = safeNext(input.next);
    const providers = data.session.user.app_metadata;
    const calendarNext =
      next === "/account" &&
      !recovery &&
      data.session.provider_token &&
      (providers.provider === "google" || providers.providers?.includes("google"))
        ? calendarReturn
        : undefined;
    if (next === "/reset-password") await requireRecoverySession();
    const assurance = await auth.mfa.getAuthenticatorAssuranceLevel(data.session.access_token);
    if (assurance.error) throw assurance.error;
    await verifyCallbackSession(data.session);
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
      return calendarNext ? `/mfa?next=${encodeURIComponent(calendarNext)}` : "/mfa";
    if (next !== "/reset-password" && hasDeletionReceipt(data.session.user.id))
      return "/account/deletion";
    await queries.query(accountQuery(data.session.user.id, next === "/account"));
    await verifyCallbackSession(data.session);
    return calendarNext ?? next;
  })();
  exchange = { code, result };
  return result;
}
