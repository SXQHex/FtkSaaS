import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverClient } from "../../lib/supabase/server";
import { InvitationAccept } from "../../components/account/invitation-accept";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: (await getTranslations("account"))("acceptInvitation"),
    robots: { index: false, follow: false },
  };
}
export default async function InvitePage() {
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect("/login?next=/invite");
  const assurance = await client!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect("/mfa?next=/invite");
  return <InvitationAccept nativeUserId={result.data.user.id} />;
}
