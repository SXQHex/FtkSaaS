import { useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "./auth-layout";
import { LoginForm } from "./login-form";
import { loginWithGoogle, loginWithPassword } from "./auth";
export function LoginPage() {
  const navigate = useNavigate();
  return (
    <AuthLayout>
      <LoginForm
        onPassword={async (values) => {
          const to = await loginWithPassword(values);
          await navigate({ to });
        }}
        onGoogle={loginWithGoogle}
      />
    </AuthLayout>
  );
}
