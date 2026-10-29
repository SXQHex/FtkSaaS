import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthFields } from "../../../components/auth/auth-fields";
import { serverClient } from "../../../lib/supabase/server";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("mfaTitle") };
}
export default async function MfaPage() {
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect("/giris?error=session");
  return (
    <>
      <AuthFields mode="mfa" />
    </>
  );
}
