import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverClient } from "../../../lib/supabase/server";
import { DeletionProgress } from "../../../components/account/deletion-progress";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: (await getTranslations("account"))("deletionProgress"),
    robots: { index: false, follow: false },
  };
}
export default async function DeletionPage() {
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect("/login?next=/account/deletion");
  const assurance = await client!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect("/mfa?next=/account/deletion");
  return <DeletionProgress nativeUserId={result.data.user.id} />;
}
