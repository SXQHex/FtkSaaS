// Page composition adapted from the @shadcn/login-02 layout; no custom controls.
import { CalendarIcon, WalletIcon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { LoginForm } from "./login-form";
import { loginWithGoogle, loginWithPassword } from "./auth";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <main className="auth-layout">
      <div className="auth-left">
        <a href="/login" className="auth-brand">
          <span className="auth-logo">{t(($) => $.auth.brandInitials)}</span>
          {t(($) => $.auth.brand)}
        </a>
        <div className="auth-form-position">
          <div className="auth-form-width">
            <LoginForm
              onPassword={async (values) => {
                const to = await loginWithPassword(values);
                await navigate({ to });
              }}
              onGoogle={loginWithGoogle}
            />
          </div>
        </div>
      </div>
      <aside className="auth-pitch" aria-hidden="true">
        <div>
          <h2>{t(($) => $.auth.pitch)}</h2>
          <ul>
            <li>
              <CalendarIcon />
              {t(($) => $.auth.calendarPitch)}
            </li>
            <li>
              <WalletIcon />
              {t(($) => $.auth.financePitch)}
            </li>
            <li>
              <UsersIcon />
              {t(($) => $.auth.memberPitch)}
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
