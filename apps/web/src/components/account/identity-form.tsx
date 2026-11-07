"use client";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AccountView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { PasswordChange } from "./password-change";
import { AccountField } from "./account-field";
import { browserClient } from "../../lib/supabase/client";
import { appOrigin } from "../../lib/config";
import { rememberAuthReturn } from "../../lib/auth-return";

export function IdentityForm({ account, onSaved }: { account: AccountView; onSaved: () => void }) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await task();
      setNotice("verificationRequested");
      onSaved();
    } catch {
      setError("providerFailed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    void run(async () => {
      await rememberAuthReturn("/account");
      const result = await browserClient().auth.updateUser(
        { email },
        { emailRedirectTo: `${appOrigin()}/auth/callback` },
      );
      if (result.error) throw result.error;
    });
  }
  const identity = account.identity;
  return (
    <section aria-labelledby="identity-heading" className="space-y-5">
      <h2 id="identity-heading" className="text-xl font-semibold">
        {t("identity")}
      </h2>
      <dl className="space-y-3 text-sm wrap-anywhere">
        {(["email", "phone", "pending_email"] as const)
          .filter((kind) => !!identity?.[kind])
          .map((kind) => (
            <div key={kind}>
              <dt className="text-muted-foreground">{t(kind)}</dt>
              <dd>{identity?.[kind]}</dd>
            </div>
          ))}
      </dl>
      {error && <p role="alert">{t(error)}</p>}
      {notice && (
        <output className="block" aria-live="polite">
          {t(notice)}
        </output>
      )}
      <form onSubmit={updateEmail} className="space-y-3">
        <AccountField
          label={t("new_email")}
          placeholder="name@example.com"
          id="new-email"
          name="email"
          type="email"
          required
          disabled={busy}
          autoComplete="email"
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {t("requestVerification")}
        </Button>
        {identity?.pending_email && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await rememberAuthReturn("/account");
                const result = await browserClient().auth.resend({
                  type: "email_change",
                  email: identity.pending_email!,
                  options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
                });
                if (result.error) throw result.error;
              })
            }
          >
            {t("resend")}
          </Button>
        )}
      </form>
      <PasswordChange onSaved={onSaved} />
    </section>
  );
}
