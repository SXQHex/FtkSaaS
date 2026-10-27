import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { AuthLayout } from "../../components/auth-layout";
import { serverClient } from "../../lib/supabase/server";
export const metadata = { title: "İki adımlı doğrulama" };
export default async function MfaPage() {
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect("/giris?error=session");
  return (
    <AuthLayout>
      <AuthForm mode="mfa" />
    </AuthLayout>
  );
}
