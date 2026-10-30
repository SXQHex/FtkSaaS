"use client";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AccountView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { browserClient } from "../../lib/supabase/client";
import { appOrigin } from "../../lib/config";
import { rememberAuthReturn } from "../../lib/auth-return";
import { accountCall } from "../../lib/account";

export function IdentityForm({ account, onSaved }: { account: AccountView; onSaved: () => void }) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError(false);
    try {
      await task();
      setNotice(message);
      onSaved();
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function update(event: FormEvent<HTMLFormElement>, kind: "email" | "phone") {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get(kind)).trim();
    void run(async () => {
      if (kind === "email") await rememberAuthReturn("/account");
      const result = await browserClient().auth.updateUser(
        { [kind]: value },
        kind === "email" ? { emailRedirectTo: `${appOrigin()}/auth/callback` } : undefined,
      );
      if (result.error) throw result.error;
    }, "verificationRequested");
  }
  const identity = account.identity;
  return (
    <section aria-labelledby="identity-heading" className="space-y-5">
      <h2 id="identity-heading" className="text-xl font-semibold">
        {t("identity")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("identityHint")}</p>
      <dl className="space-y-3 text-sm wrap-anywhere">
        {(["email", "phone", "pending_email", "pending_phone", "unverified_phone"] as const).map(
          (kind) => (
            <div key={kind}>
              <dt className="text-muted-foreground">{t(kind)}</dt>
              <dd>{identity?.[kind] ?? t("none")}</dd>
            </div>
          ),
        )}
      </dl>
      {error && <p role="alert">{t("providerFailed")}</p>}
      {notice && (
        <output className="block" aria-live="polite">
          {t(notice)}
        </output>
      )}
      {(["email", "phone"] as const).map((kind) => (
        <form key={kind} onSubmit={(event) => update(event, kind)} className="space-y-3">
          <Label htmlFor={`new-${kind}`}>{t(`new_${kind}`)}</Label>
          <Input
            id={`new-${kind}`}
            name={kind}
            type={kind === "email" ? "email" : "tel"}
            pattern={kind === "phone" ? "\\+[1-9][0-9]{7,14}" : undefined}
            required
            disabled={busy}
            autoComplete={kind}
          />
          <Button type="submit" variant="outline" disabled={busy}>
            {t("requestVerification")}
          </Button>
          {identity?.[kind === "email" ? "pending_email" : "pending_phone"] && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const value = identity[kind === "email" ? "pending_email" : "pending_phone"]!;
                  if (kind === "email") await rememberAuthReturn("/account");
                  const result =
                    kind === "email"
                      ? await browserClient().auth.resend({
                          type: "email_change",
                          email: value,
                          options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
                        })
                      : await browserClient().auth.resend({ type: "phone_change", phone: value });
                  if (result.error) throw result.error;
                }, "verificationRequested")
              }
            >
              {t("resend")}
            </Button>
          )}
        </form>
      ))}
      {identity?.pending_phone && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const token = String(new FormData(event.currentTarget).get("code"));
            void run(async () => {
              const result = await browserClient().auth.verifyOtp({
                phone: identity.pending_phone!,
                token,
                type: "phone_change",
              });
              if (result.error) throw result.error;
            }, "saved");
          }}
        >
          <Label htmlFor="phone-code">{t("phoneCode")}</Label>
          <Input
            id="phone-code"
            name="code"
            autoComplete="one-time-code"
            inputMode="numeric"
            required
            disabled={busy}
          />
          <Button disabled={busy}>{t("verify")}</Button>
        </form>
      )}
      <details className="space-y-4 border-t pt-5">
        <summary className="cursor-pointer font-medium">{t("password")}</summary>
        <p className="text-sm text-muted-foreground">{t("passwordHint")}</p>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(() => accountCall("account_password_change_v1", {}), "nonceRequested")
          }
        >
          {t("sendNonce")}
        </Button>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (data.get("password") !== data.get("confirm")) {
              setError(true);
              return;
            }
            void run(async () => {
              const result = await browserClient().auth.updateUser({
                password: String(data.get("password")),
                nonce: String(data.get("nonce")),
              });
              if (result.error) throw result.error;
              form.reset();
            }, "saved");
          }}
        >
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={busy}
          />
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <Input
            id="confirm-password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={busy}
          />
          <Label htmlFor="password-nonce">{t("nonce")}</Label>
          <Input
            id="password-nonce"
            name="nonce"
            autoComplete="one-time-code"
            required
            disabled={busy}
          />
          <Button disabled={busy}>{t("changePassword")}</Button>
        </form>
      </details>
    </section>
  );
}
