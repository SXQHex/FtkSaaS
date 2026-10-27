import { AuthForm } from "../../components/auth-form";
import { AuthLayout } from "../../components/auth-layout";
import { publicConfig } from "../../lib/config";
export const metadata = { title: "Parola kurtarma" };
export default function RecoveryPage() {
  return (
    <AuthLayout>
      <AuthForm mode="recovery" configured={!!publicConfig()} />
    </AuthLayout>
  );
}
