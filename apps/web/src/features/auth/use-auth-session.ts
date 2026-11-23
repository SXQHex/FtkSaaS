import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getSupabaseClient } from "../../lib/supabase";
import { nativeSessionId } from "./native-session-id";

type NativeIdentity = { userId: string; sessionId: string | undefined };

function sessionIdentity(session: Session | null): NativeIdentity | null {
  return session ? { userId: session.user.id, sessionId: nativeSessionId(session) } : null;
}

function sameSession(previous: NativeIdentity | null | undefined, current: NativeIdentity | null) {
  if (previous === undefined) return false;
  if (previous === null || current === null) return previous === current;
  // If either token lacks a trustworthy session identifier, fail closed:
  // equality of the user UUID alone is insufficient for private cache reuse.
  return (
    previous.userId === current.userId &&
    previous.sessionId !== undefined &&
    previous.sessionId === current.sessionId
  );
}

export function useAuthSession(enabled = true) {
  const [ready, setReady] = useState(true);
  const queries = useQueryClient();
  const router = useRouter();
  // Keep the last native identity when the observer pauses for public routes.
  const previous = useRef<NativeIdentity | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      return;
    let revision = 0;
    let mounted = true;
    const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
      const current = sessionIdentity(session);
      const changed = !sameSession(previous.current, current);
      if (event === "INITIAL_SESSION" && previous.current === undefined) {
        previous.current = current;
        return;
      }
      previous.current = current;
      // SIGNED_IN is re-emitted on focus; TOKEN_REFRESHED and MFA keep the
      // original session_id. An actual same-user reauthentication does not.
      if (event === "SIGNED_OUT" || changed) sessionStorage.removeItem("ftk-recovery-account");
      if (!changed && event !== "SIGNED_OUT" && event !== "PASSWORD_RECOVERY") return;
      const next = ++revision;
      setReady(false);
      queries.clear();
      // Defer SDK-dependent route reads until the native callback has returned.
      setTimeout(() => {
        if (!mounted || next !== revision) return;
        void router.invalidate({ sync: true }).then(
          () => {
            if (mounted && next === revision) setReady(true);
          },
          () => {
            if (mounted && next === revision) window.location.replace("/login");
          },
        );
      }, 0);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [enabled, queries, router]);
  return ready;
}
