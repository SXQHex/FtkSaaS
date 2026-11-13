import { getSupabaseClient } from "../../lib/supabase";
import { readAccount } from "../../lib/account";
import { rememberRecoverySession, requireRecoverySession } from "./password-recovery";

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
    providerError: search.has("error") || fragment.has("error"),
    next: safeNext(search.get("next")),
  };
  window.history.replaceState(window.history.state, "", "/auth/callback");
}

export function capturedCallback() {
  return captured ?? { next: "/account" };
}

let exchange: { code: string; result: Promise<string> } | undefined;

export function completeCallback(input: CallbackInput): Promise<string> {
  if (input.providerError || !input.code) return Promise.reject(new Error("AUTH_CALLBACK_INVALID"));
  if (exchange?.code === input.code) return exchange.result;
  const code = input.code;
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
    if (recovery) await rememberRecoverySession(data.session);
    const next = safeNext(input.next);
    if (next === "/reset-password") await requireRecoverySession();
    const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
      return "/mfa";
    await readAccount();
    return next;
  })();
  exchange = { code, result };
  return result;
}
