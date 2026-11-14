// Shared composition from the official @shadcn/login-02 page layout.
import type { ReactNode } from "react";
import { CalendarIcon, WalletIcon, UsersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="auth-layout">
      <div className="auth-left">
        <a href="/login" className="auth-brand">
          <span className="auth-logo">{t(($) => $.auth.brandInitials)}</span>
          {t(($) => $.auth.brand)}
        </a>
        <div className="auth-form-position">
          <div className="auth-form-width">{children}</div>
        </div>
      </div>
      <AuthPitch />
    </main>
  );
}

export function AuthPitch() {
  const { t } = useTranslation();
  return (
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
  );
}
