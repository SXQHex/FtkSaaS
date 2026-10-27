import { AuthForm } from "../../components/auth-form";
import { AuthLayout } from "../../components/auth-layout";
import { publicConfig } from "../../lib/config";
export const metadata = { title: "Giriş" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout>
      <AuthForm
        configured={!!publicConfig()}
        initialError={
          error
            ? "Giriş bağlantısı geçersiz, süresi dolmuş veya iptal edilmiş. Yeniden dene."
            : undefined
        }
      />
    </AuthLayout>
  );
}
