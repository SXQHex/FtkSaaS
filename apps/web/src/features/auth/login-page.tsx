import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout } from "./auth-layout";
import { LoginForm } from "./login-form";
import { loginWithGoogle, loginWithPassword } from "./auth";
export function LoginPage() {
  const navigate = useNavigate();
  const queries = useQueryClient();
  return (
    <AuthLayout>
      <LoginForm
        onPassword={async (values) => {
          const to = await loginWithPassword(values, queries);
          await navigate({ to });
        }}
        onGoogle={loginWithGoogle}
      />
    </AuthLayout>
  );
}
