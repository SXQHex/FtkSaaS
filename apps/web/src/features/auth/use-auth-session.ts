import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getSupabaseClient } from "../../lib/supabase";
import { advancePrivateQueryRevision } from "../../lib/cache-invalidation";
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

export function useAuthSession(enabled = true, onSessionHandoff?: (pending: boolean) => void) {
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  const [ready, setReady] = useState(!configured);
  const [observing, setObserving] = useState(enabled);
  if (observing !== enabled) {
    setObserving(enabled);
    setReady(!configured);
  }
  const queries = useQueryClient();
  const router = useRouter();
  // Keep the last native identity when the observer pauses for public routes.
  const previous = useRef<NativeIdentity | null | undefined>(undefined);
  useEffect(() => {
    if (!configured || !enabled) return;
    let revision = 0;
    let mounted = true;
    const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
      const current = sessionIdentity(session);
      const changed = !sameSession(previous.current, current);
      if (event === "INITIAL_SESSION" && previous.current === undefined) {
        previous.current = current;
        setReady(true);
        return;
      }
      const sameActorHandoff =
        changed &&
        previous.current !== null &&
        previous.current !== undefined &&
        current !== null &&
        previous.current.userId === current.userId;
      previous.current = current;
      if (event === "INITIAL_SESSION" && !changed) {
        // Resubscribing after a public route keeps the proven same session.
        if (revision === 0) {
          setReady(true);
          onSessionHandoff?.(false);
        }
        return;
      }
      // SIGNED_IN is re-emitted on focus; TOKEN_REFRESHED and MFA keep the
      // original session_id. An actual same-user reauthentication does not.
      if (event === "SIGNED_OUT" || changed) sessionStorage.removeItem("ftk-recovery-account");
      if (!changed && event !== "SIGNED_OUT" && event !== "PASSWORD_RECOVERY") return;
      const next = ++revision;
      advancePrivateQueryRevision(queries);
      onSessionHandoff?.(sameActorHandoff);
      setReady(false);
      if (sameActorHandoff) {
        // Evict prior-session Query data without destroying a running
        // native command's TanStack MutationCache/receipt lifetime.
        queries.removeQueries();
      } else {
        // Sign-out and actor replacement discard both Queries and mutations.
        queries.clear();
      }
      // Defer SDK-dependent route reads until the native callback has returned.
      setTimeout(() => {
        if (!mounted || next !== revision) return;
        void router.invalidate({ sync: true }).then(
          () => {
            if (mounted && next === revision) {
              setReady(true);
              onSessionHandoff?.(false);
            }
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
  }, [configured, enabled, queries, router, onSessionHandoff]);
  return configured ? enabled && ready : true;
}
