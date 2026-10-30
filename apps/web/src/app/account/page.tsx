import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serverClient } from "../../lib/supabase/server";
import { AccountWorkspace } from "../../components/account/account-workspace";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getTranslations("account"))("title") };
}
export default async function AccountPage() {
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect("/login?next=/account");
  const assurance = await client!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect("/mfa?next=/account");
  return <AccountWorkspace authUserId={result.data.user.id} />;
}
