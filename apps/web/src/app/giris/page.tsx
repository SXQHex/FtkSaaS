import { getTranslations } from "next-intl/server";
import { AuthForm } from "../../components/auth-form";
import { AuthLayout } from "../../components/auth-layout";
import { publicConfig } from "../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("loginTitle") };
}
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout>
      <AuthForm configured={!!publicConfig()} initialError={!!error} />
    </AuthLayout>
  );
}
