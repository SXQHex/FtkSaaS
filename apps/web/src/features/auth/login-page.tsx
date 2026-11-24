import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout } from "./auth-layout";
import { LoginForm } from "./login-form";
import { loginWithGoogle, loginWithPassword } from "./auth";
export function LoginPage() {
  const navigate = useNavigate();
  const queries = useQueryClient();
  const { next } = useSearch({ from: "/login" });
  return (
    <AuthLayout>
      <LoginForm
        onPassword={async (values) => {
          const to = await loginWithPassword(values, queries);
          if (to === "/account" && next) await navigate({ href: next, replace: true });
          else if (to === "/mfa" && next) await navigate({ to, search: { next }, replace: true });
          else await navigate({ to });
        }}
        onGoogle={() => loginWithGoogle(next)}
      />
    </AuthLayout>
  );
}
