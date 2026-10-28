"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ftksaas/ui/components/card";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { browserClient } from "../lib/supabase/client";
import { appOrigin } from "../lib/config";

type Mode = "login" | "recovery" | "update" | "mfa";
function authMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "invalid_credentials") return "invalidCredentials";
  if (code === "email_not_confirmed") return "emailUnconfirmed";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "rateLimit";
  if (code === "mfa_verification_failed")
    return "invalidCode";
  return "failed";
}
// Layout adapted from shadcn/ui login-01; source recorded in packages/ui/registry-sources.json.
export function AuthForm({
  mode = "login",
  configured = true,
  initialError,
}: {
  mode?: Mode;
  configured?: boolean;
  initialError?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ? "callbackError" : "");
  const [notice, setNotice] = useState("");
  const text = { title: t(`${mode}Title`), description: t(`${mode}Description`), submit: t(`${mode}Submit`) };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const client = browserClient();
      if (mode === "login") {
        const result = await client.auth.signInWithPassword({
          email: String(form.get("email")),
          password: String(form.get("password")),
        });
        if (result.error) throw result.error;
        router.replace("/");
        router.refresh();
      } else if (mode === "recovery") {
        const result = await client.auth.resetPasswordForEmail(String(form.get("email")), {
          redirectTo: `${appOrigin()}/auth/callback?next=/parola-yenile`,
        });
        if (result.error) throw result.error;
        setNotice(
          "recoveryNotice",
        );
      } else if (mode === "update") {
        if (form.get("password") !== form.get("confirm")) {
          setError("passwordMismatch");
          return;
        }
        const result = await client.auth.updateUser({ password: String(form.get("password")) });
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
        router.replace("/");
        router.refresh();
      }
    } catch (cause) {
      setError(authMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    setError("");
    try {
      const result = await browserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${appOrigin()}/auth/callback` },
      });
      if (result.error) throw result.error;
    } catch (cause) {
      setError(authMessage(cause));
      setBusy(false);
    }
  }
  return (
    <Card className="w-full min-w-0 wrap-anywhere shadow-none">
      <CardHeader className="min-w-0 space-y-2 px-4 sm:px-6">
        <CardTitle className="text-2xl leading-tight">
          <h1>{text.title}</h1>
        </CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-6 px-4 sm:px-6">
        {!configured ? (
          <Alert>
            <AlertDescription>
              {t("notConfigured")}
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert" aria-label={t("errorLabel")}>
            <AlertDescription>{t(error)}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm leading-relaxed">
            {t(notice)}
          </p>
        ) : null}
        <form onSubmit={submit} className="space-y-5" aria-label={text.title} aria-busy={busy}>
          {mode === "login" || mode === "recovery" ? (
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                disabled={busy || !configured}
                className="min-h-11"
              />
            </div>
          ) : null}
          {mode === "login" || mode === "update" ? (
            <div className="space-y-2">
              <Label htmlFor="password">{mode === "update" ? t("newPassword") : t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "update" ? 8 : undefined}
                required
                disabled={busy || !configured}
                className="min-h-11"
              />
            </div>
          ) : null}
          {mode === "update" ? (
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("confirm")}</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                disabled={busy}
                className="min-h-11"
              />
            </div>
          ) : null}
          {mode === "mfa" ? (
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
                disabled={busy}
                className="min-h-11"
              />
            </div>
          ) : null}
          {mode === "login" ? (
            <Link
              className="inline-block text-sm text-primary underline-offset-4 hover:underline"
              href="/parolami-unuttum"
            >
              {t("forgot")}
            </Link>
          ) : null}
          <Button
            type="submit"
            className="h-auto min-h-11 w-full whitespace-normal py-3"
            disabled={busy || !configured}
          >
            {busy ? t("busy") : text.submit}
          </Button>
        </form>
        {mode === "login" ? (
          <Button
            onClick={google}
            type="button"
            variant="outline"
            className="h-auto min-h-11 w-full whitespace-normal py-3"
            disabled={busy || !configured}
          >
            {t("google")}
          </Button>
        ) : (
          <Link
            className="inline-block text-sm text-primary underline-offset-4 hover:underline"
            href={mode === "update" && notice ? "/" : "/giris"}
          >
            {mode === "update" && notice ? common("workspace") : common("back")}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
