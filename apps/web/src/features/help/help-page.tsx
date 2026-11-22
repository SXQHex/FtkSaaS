import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAccountProjection } from "../auth/use-account-projection";
import { WorkspaceLayout } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { getSupabaseClient } from "../../lib/supabase";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { HelpContent } from "./help-content";
export function HelpPage() {
  const account = useAccountProjection();
  const navigate = useNavigate(),
    router = useRouter(),
    queries = useQueryClient();
  const { t } = useTranslation();
  useAccountAppearance(account.id);
  const [pending, setPending] = useState(false),
    [failed, setFailed] = useState(false);
  async function signOut() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }
    queries.clear();
    await navigate({ to: "/login", replace: true });
    await router.invalidate();
  }
  return (
    <WorkspaceLayout
      accountId={account.id}
      name={account.display_name}
      pending={pending}
      onSignOut={() => {
        void signOut();
      }}
      pageTitle={t(($) => $.help.title)}
    >
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
        </Alert>
      )}
      <HelpContent />
    </WorkspaceLayout>
  );
}
