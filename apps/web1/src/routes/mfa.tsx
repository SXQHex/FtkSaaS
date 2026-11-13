import { createFileRoute, redirect } from "@tanstack/react-router";
import { MfaPage } from "../features/auth/mfa-page";
import { getSupabaseClient } from "../lib/supabase";
export const Route = createFileRoute("/mfa")({
  beforeLoad: async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error || !data.session) throw redirect({ to: "/login" });
  },
  component: MfaPage,
});
