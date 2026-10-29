import { redirect } from "next/navigation";
import { serverClient } from "../lib/supabase/server";
import { StudioWorkspace } from "../components/admin/studio-workspace";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const client = await serverClient();
  if (!client) redirect("/giris");
  const result = await client.auth.getUser();
  if (!result?.data.user || result.error) redirect("/giris");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect("/dogrulama");
  return <StudioWorkspace />;
}
