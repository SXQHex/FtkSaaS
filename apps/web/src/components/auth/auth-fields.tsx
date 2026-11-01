"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { checkSignup } from "../../lib/signup-check";
import { browserClient } from "../../lib/supabase/client";
import { appOrigin, safeReturnPath } from "../../lib/config";
import { rememberAuthReturn } from "../../lib/auth-return";

import { preserveInvitationReturn } from "../../lib/invitation-return";

type Mode = "login" | "signup" | "recovery" | "update" | "mfa";
function authMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "user_already_exists" || code === "email_exists") return "accountExists";
  if (code === "invalid_credentials") return "invalidCredentials";
  if (code === "email_not_confirmed") return "emailUnconfirmed";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "rateLimit";
  if (code === "mfa_verification_failed") return "invalidCode";
  if (code === "invitation_return_failed") return "invitationReturnFailed";
  if (code === "weak_password") return "weakPassword";
  if (code === "same_password") return "samePassword";
  if (code === "reauthentication_needed" || code === "current_password_required")
    return "recoveryRequired";
  if (code === "signup_disabled") return "signupDisabled";
  return "failed";
}

// Shared form composition from login-02/signup-02, using the existing shadcn primitives.
export function AuthFields({
  mode = "login",
  configured = true,
  initialError,
  returnTo = "/",
}: {
  mode?: Mode;
  configured?: boolean;
  initialError?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    initialError ? (mode === "recovery" ? "recoveryLinkError" : "callbackError") : "",
  );
  const [notice, setNotice] = useState("");
  const [signupIdentity, setSignupIdentity] = useState({ email: "", name: "" });
  const [resendRequested, setResendRequested] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const social = mode === "login" || mode === "signup";
  const newPassword = mode === "signup" || mode === "update";
  const confirmed = mode === "signup" && notice === "signupNotice";
  const destination = safeReturnPath(returnTo);
  const returnQuery = destination === "/" ? "" : `?next=${encodeURIComponent(destination)}`;
  useEffect(() => {
    try {
      preserveInvitationReturn(destination);
    } catch {
      // Keep the fragment intact; submit retries storage and explains failure.
      return;
    }
  }, [destination]);
  function preserveInvitation() {
    try {
      preserveInvitationReturn(destination);
    } catch {
      throw Object.assign(new Error("Invitation return storage unavailable"), {
        code: "invitation_return_failed",
      });
    }
  }
  function enter() {
    router.replace(destination);
    router.refresh();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !configured) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      preserveInvitation();
      if (newPassword && form.get("password") !== form.get("confirm")) {
        setError("passwordMismatch");
        return;
      }
      const client = browserClient();
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      if (mode === "login") {
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        enter();
      } else if (mode === "signup") {
        if (!String(form.get("name") ?? "").trim()) {
          setError("nameRequired");
          return;
        }
        const check = await checkSignup(email);
        if (!check.ok) {
          setError(check.error.code === "RATE_LIMITED" ? "rateLimit" : "signupCheckUnavailable");
          return;
        }
        if (check.data.status === "account_exists") {
          setError("accountExists");
          return;
        }
        await rememberAuthReturn(destination);
        const result = await client.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(form.get("name") ?? "").trim() },
            emailRedirectTo: `${appOrigin()}/auth/callback`,
          },
        });
        if (result.error) throw result.error;
        if (result.data.session) enter();
        else {
          setSignupIdentity({ email, name: String(form.get("name")).trim() });
          setResendRequested(false);
          setNotice("signupNotice");
        }
      } else if (mode === "recovery") {
        const result = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
        });
        if (result.error) throw result.error;
        setNotice("recoveryNotice");
      } else if (mode === "update") {
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        setNotice("updated");
      } else {
        const factors = await client.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const factor = factors.data.totp.find((item) => item.status === "verified");
        if (!factor) {
          setError("noFactor");
          return;
        }
        const result = await client.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: String(form.get("code")),
        });
        if (result.error) throw result.error;
        enter();
      }
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function resendSignup() {
    if (pending.current || !signupIdentity.email) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setResendRequested(false);
    try {
      preserveInvitation();
      await rememberAuthReturn(destination);
      const result = await browserClient().auth.resend({
        type: "signup",
        email: signupIdentity.email,
        options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
      });
      if (result.error) throw result.error;
      setResendRequested(true);
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function google() {
    if (pending.current || !configured) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      preserveInvitation();
      await rememberAuthReturn(destination);
      const result = await browserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${appOrigin()}/auth/callback` },
      });
      if (result.error) throw result.error;
    } catch (cause) {
      setError(authMessage(cause));
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-7 wrap-anywhere">
      <div className="space-y-3">
        {confirmed && <MailCheck aria-hidden="true" className="mb-5 size-9 stroke-[1.5]" />}
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          {t(confirmed ? "confirmTitle" : `${mode}Title`)}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t(confirmed ? "confirmDescription" : `${mode}Description`)}
        </p>
      </div>
      {!configured && (
        <Alert>
          <AlertDescription>{t("notConfigured")}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" role="alert" aria-label={t("errorLabel")}>
          <AlertDescription>{t(error)}</AlertDescription>
        </Alert>
      )}
      {mode === "update" && error === "recoveryRequired" && (
        <Link href="/forgot-password" className="text-sm underline">
          {t("requestRecovery")}
        </Link>
      )}
      {notice && (
        <output
          className="block rounded-xl border bg-muted/50 p-4 text-sm leading-6"
          aria-live="polite"
        >
          {t(notice)}
        </output>
      )}
      {confirmed && (
        <p className="text-sm leading-6">{t("signupAddress", { email: signupIdentity.email })}</p>
      )}
      {confirmed && resendRequested && (
        <output className="block text-sm leading-6" aria-live="polite">
          {t("resendRequested")}
        </output>
      )}
      {!confirmed && !(mode === "update" && notice) && (
        <form
          onSubmit={submit}
          className="space-y-5"
          aria-label={t(`${mode}Title`)}
          aria-busy={busy}
        >
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">{t("fullName")}</Label>
              <Input
                id="name"
                name="name"
                defaultValue={signupIdentity.name}
                autoComplete="name"
                required
                maxLength={120}
                disabled={busy || !configured}
                className="min-h-11"
              />
            </div>
          )}
          {(social || mode === "recovery") && (
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                defaultValue={mode === "signup" ? signupIdentity.email : undefined}
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                disabled={busy || !configured}
                className="min-h-11"
              />
            </div>
          )}
          {(social || mode === "update") && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="password">
                  {t(mode === "update" ? "newPassword" : "password")}
                </Label>
                {mode === "login" && (
                  <Link
                    className="text-xs underline-offset-4 hover:underline"
                    href="/forgot-password"
                  >
                    {t("forgot")}
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={newPassword ? "new-password" : "current-password"}
                  minLength={newPassword ? 8 : undefined}
                  required
                  disabled={busy || !configured}
                  aria-describedby={newPassword ? "password-help" : undefined}
                  className="min-h-11 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-11"
                  aria-label={t(showPassword ? "hidePassword" : "showPassword")}
                  aria-controls="password"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={busy || !configured}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              {newPassword && (
                <p id="password-help" className="text-xs leading-5 text-muted-foreground">
                  {t("passwordHint")}
                </p>
              )}
            </div>
          )}
          {newPassword && (
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("confirm")}</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  name="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={busy || !configured}
                  className="min-h-11 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-11"
                  aria-label={t(showConfirm ? "hideConfirmPassword" : "showConfirmPassword")}
                  aria-controls="confirm"
                  aria-pressed={showConfirm}
                  onClick={() => setShowConfirm(!showConfirm)}
                  disabled={busy || !configured}
                >
                  {showConfirm ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
            </div>
          )}
          {mode === "mfa" && (
            <div className="space-y-2">
              <Label htmlFor="code">{t("code")}</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                disabled={busy || !configured}
                className="min-h-12 text-center text-xl tracking-[0.3em]"
              />
            </div>
          )}
          <Button
            type="submit"
            className="h-auto min-h-11 w-full whitespace-normal py-3"
            disabled={busy || !configured}
          >
            {busy && <LoaderCircle className="shrink-0 animate-spin" aria-hidden="true" />}
            {busy ? t("busy") : t(`${mode}Submit`)}
          </Button>
        </form>
      )}
      {confirmed && (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void resendSignup()}
          >
            {t("resendSignup")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setNotice("");
              setError("");
              setResendRequested(false);
            }}
          >
            {t("changeSignupEmail")}
          </Button>
        </div>
      )}
      {social && !confirmed && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>{t("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            onClick={google}
            type="button"
            variant="outline"
            className="h-auto min-h-11 w-full whitespace-normal py-3"
            disabled={busy || !configured}
          >
            {t("google")}
          </Button>
        </div>
      )}
      {social ? (
        <p className="text-center text-sm leading-6 text-muted-foreground">
          {t(mode === "login" ? "noAccount" : "haveAccount")}{" "}
          <Link
            href={`${mode === "login" ? "/signup" : "/login"}${returnQuery}`}
            onClick={(event) => {
              try {
                preserveInvitation();
              } catch (cause) {
                event.preventDefault();
                setError(authMessage(cause));
              }
            }}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t(mode === "login" ? "signupLink" : "loginSubmit")}
          </Link>
        </p>
      ) : (
        <Link
          href={mode === "update" && notice ? "/" : "/login"}
          className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          {common(mode === "update" && notice ? "workspace" : "back")}
        </Link>
      )}
    </div>
  );
}
