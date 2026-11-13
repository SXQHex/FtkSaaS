import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getSupabaseClient } from "../../lib/supabase";

export function useAuthSession() {
  const [ready, setReady] = useState(true);
  const queries = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      return;
    let previous: string | null | undefined;
    let revision = 0;
    let mounted = true;
    const { data } = getSupabaseClient().auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null;
      if (event === "INITIAL_SESSION") {
        previous = id;
        return;
      }
      // SIGNED_IN is also re-emitted when the same native session regains focus.
      // Recovery remains bound to its verified native session UUID, not just its account.
      if (event === "SIGNED_OUT" || id !== previous)
        sessionStorage.removeItem("ftk-recovery-account");
      if (id === previous && event !== "SIGNED_OUT" && event !== "PASSWORD_RECOVERY") return;
      previous = id;
      const current = ++revision;
      setReady(false);
      queries.clear();
      // Defer SDK-dependent route reads until the native callback has returned.
      setTimeout(() => {
        if (!mounted) return;
        void router.invalidate({ sync: true }).then(
          () => {
            if (mounted && current === revision) setReady(true);
          },
          () => {
            if (mounted) window.location.replace("/login");
          },
        );
      }, 0);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queries, router]);
  return ready;
}
