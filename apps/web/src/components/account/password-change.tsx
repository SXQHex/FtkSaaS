"use client";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { AccountField } from "./account-field";
import { browserClient } from "../../lib/supabase/client";

type Field = "current_password" | "password" | "confirm" | "nonce";
export function PasswordChange({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [message, setMessage] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [currentRequired, setCurrentRequired] = useState(false);
  const lock = useRef(false);
  async function requestCode() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setCodeSent(false);
    try {
      const result = await browserClient().auth.reauthenticate();
      if (result.error) throw result.error;
      setCodeSent(true);
      setErrors({});
      setMessage("passwordCodeSent");
    } catch {
      setMessage("providerFailed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage("");
    setErrors({});
    if (data.get("password") !== data.get("confirm")) {
      setErrors({ confirm: t("passwordMismatch") });
      form.querySelector<HTMLInputElement>('[name="confirm"]')?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const current = String(data.get("current_password") ?? "");
      const result = await browserClient().auth.updateUser({
        password: String(data.get("password")),
        ...(current ? { current_password: current } : {}),
        ...(codeSent ? { nonce: String(data.get("nonce")) } : {}),
      });
      if (result.error) throw result.error;
      form.reset();
      setCodeSent(false);
      setNeedsReauth(false);
      setMessage("passwordChanged");
      onSaved();
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
      // Native Auth may consume a nonce even when a later password check fails.
      if (codeSent) {
        setCodeSent(false);
        setNeedsReauth(true);
        const nonce = form.querySelector<HTMLInputElement>('[name="nonce"]');
        if (nonce) nonce.value = "";
      }
      if (code === "reauthentication_needed") {
        setNeedsReauth(true);
        setMessage("passwordCodeRequired");
      } else if (code === "reauthentication_not_valid") {
        setNeedsReauth(true);
        setMessage("passwordCodeInvalid");
      } else if (code === "current_password_required" || code === "current_password_invalid") {
        setCurrentRequired(true);
        setErrors({ current_password: t(code) });
      } else if (code === "weak_password" || code === "same_password") {
        setErrors({ password: t(code) });
      } else {
        setMessage("providerFailed");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function clear(field: Field) {
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }
  return (
    <details className="space-y-4 border-t pt-5">
      <summary className="cursor-pointer font-medium">{t("password")}</summary>
      {message && (
        <p
          role={
            message === "passwordChanged" || message === "passwordCodeSent" ? "status" : "alert"
          }
        >
          {t(message)}
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <AccountField
          id="current-password"
          name="current_password"
          label={t("currentPassword")}
          type="password"
          autoComplete="current-password"
          required={currentRequired}
          error={errors.current_password}
          onChange={() => clear("current_password")}
          disabled={busy}
        />
        <AccountField
          id="new-password"
          name="password"
          label={t("newPassword")}
          placeholder={t("passwordPlaceholder")}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          error={errors.password}
          onChange={() => {
            clear("password");
            clear("confirm");
          }}
          disabled={busy}
        />
        <AccountField
          id="confirm-password"
          name="confirm"
          label={t("confirmPassword")}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          error={errors.confirm}
          onChange={() => clear("confirm")}
          disabled={busy}
        />
        {codeSent && (
          <AccountField
            id="password-nonce"
            name="nonce"
            label={t("passwordCode")}
            placeholder="123456"
            autoComplete="one-time-code"
            inputMode="numeric"
            required
            disabled={busy}
          />
        )}
        <Button disabled={busy}>{t("changePassword")}</Button>
        {needsReauth && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void requestCode()}
          >
            {t(codeSent ? "resendPasswordCode" : "requestPasswordCode")}
          </Button>
        )}
      </form>
    </details>
  );
}
