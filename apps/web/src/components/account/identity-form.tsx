"use client";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { AccountView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { PasswordChange } from "./password-change";
import { AccountField } from "./account-field";
import { normalizePhone } from "../../lib/phone";
import { browserClient } from "../../lib/supabase/client";
import { appOrigin } from "../../lib/config";
import { rememberAuthReturn } from "../../lib/auth-return";

export function IdentityForm({ account, onSaved }: { account: AccountView; onSaved: () => void }) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await task();
      setNotice(message);
      onSaved();
    } catch {
      setError("providerFailed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function update(event: FormEvent<HTMLFormElement>, kind: "email" | "phone") {
    event.preventDefault();
    const form = event.currentTarget;
    const input = String(new FormData(form).get(kind)).trim();
    const value = kind === "phone" ? normalizePhone(input) : input;
    if (value === undefined) {
      setNotice("");
      setError("");
      setPhoneError(t("fieldPhone"));
      form.querySelector<HTMLInputElement>('[name="phone"]')?.focus();
      return;
    }
    setPhoneError("");
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
      <dl className="space-y-3 text-sm wrap-anywhere">
        {(["email", "phone", "pending_email", "pending_phone"] as const)
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
      {(["email", "phone"] as const).map((kind) => (
        <form key={kind} onSubmit={(event) => update(event, kind)} className="space-y-3">
          <AccountField
            label={t(`new_${kind}`)}
            placeholder={kind === "email" ? "name@example.com" : "05xx xxx xx xx"}
            error={kind === "phone" ? phoneError : undefined}
            onChange={kind === "phone" ? () => setPhoneError("") : undefined}
            id={`new-${kind}`}
            name={kind}
            type={kind === "email" ? "email" : "tel"}
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
          <AccountField
            label={t("phoneCode")}
            placeholder="123456"
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
      <PasswordChange onSaved={onSaved} />
    </section>
  );
}
