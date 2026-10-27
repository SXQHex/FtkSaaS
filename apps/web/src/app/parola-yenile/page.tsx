import { redirect } from "next/navigation";
import { AuthForm } from "../../components/auth-form";
import { AuthLayout } from "../../components/auth-layout";
import { serverClient } from "../../lib/supabase/server";
export const metadata = { title: "Yeni parola" };
export default async function UpdatePasswordPage() {
  const client = await serverClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect("/giris?error=session");
  return (
    <AuthLayout>
      <AuthForm mode="update" />
    </AuthLayout>
  );
}
