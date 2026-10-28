import { getTranslations } from "next-intl/server";
import { AuthForm } from "../../components/auth-form";
import { AuthLayout } from "../../components/auth-layout";
import { publicConfig } from "../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("recoveryTitle") };
}
export default function RecoveryPage() {
  return (
    <AuthLayout>
      <AuthForm mode="recovery" configured={!!publicConfig()} />
    </AuthLayout>
  );
}
