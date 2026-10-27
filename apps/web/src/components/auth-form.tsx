"use client";
import { useState, type FormEvent } from "react";
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
const copy: Record<Mode, { title: string; description: string; submit: string }> = {
  login: {
    title: "Yönetim alanına giriş",
    description: "Stüdyonun çalışma alanına hesabınla giriş yap.",
    submit: "Giriş yap",
  },
  recovery: {
    title: "Parolanı yenile",
    description: "Hesabına bağlı e-posta adresini yaz.",
    submit: "Yenileme bağlantısı gönder",
  },
  update: {
    title: "Yeni parolanı belirle",
    description: "Hesabın için yeni bir parola oluştur.",
    submit: "Parolayı kaydet",
  },
  mfa: {
    title: "İki adımlı doğrulama",
    description: "Doğrulama uygulamandaki altı haneli kodu gir.",
    submit: "Doğrula",
  },
};
function authMessage(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "invalid_credentials") return "E-posta veya parola hatalı. Bilgilerini kontrol et.";
  if (code === "email_not_confirmed") return "Giriş yapmadan önce e-posta adresini doğrula.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit")
    return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  if (code === "mfa_verification_failed")
    return "Doğrulama kodu hatalı veya süresi dolmuş. Yeni kodla tekrar dene.";
  return "İşlem tamamlanamadı. Bağlantını kontrol edip yeniden dene.";
}
// Layout adapted from shadcn/ui login-01; source recorded in packages/ui/registry-sources.json.
export function AuthForm({
  mode = "login",
  configured = true,
  initialError,
}: {
  mode?: Mode;
  configured?: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");
  const text = copy[mode];
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
          "Bu adresle eşleşen bir hesap varsa parola yenileme bağlantısı gönderilecek. Gelen kutunu kontrol et.",
        );
      } else if (mode === "update") {
        if (form.get("password") !== form.get("confirm")) {
          setError("Parolalar eşleşmiyor.");
          return;
        }
        const result = await client.auth.updateUser({ password: String(form.get("password")) });
        if (result.error) throw result.error;
        setNotice("Parolan güncellendi. Çalışma alanına devam edebilirsin.");
      } else {
        const factors = await client.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        const factor = factors.data.totp.find((item) => item.status === "verified");
        if (!factor) {
          setError("Doğrulanmış bir doğrulama uygulaması bulunamadı. Yeniden giriş yap.");
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
    <Card className="w-full shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl leading-tight">
          <h2>{text.title}</h2>
        </CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!configured ? (
          <Alert>
            <AlertDescription>
              Giriş bağlantısı henüz yapılandırılmadı. Uygulama yöneticisiyle iletişime geç.
            </AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert" aria-label="Giriş hatası">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm leading-relaxed">
            {notice}
          </p>
        ) : null}
        <form onSubmit={submit} className="space-y-5" aria-label={text.title} aria-busy={busy}>
          {mode === "login" || mode === "recovery" ? (
            <div className="space-y-2">
              <Label htmlFor="email">E-posta adresi</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="ad@ornek.com"
                required
                disabled={busy || !configured}
                className="min-h-11"
              />
            </div>
          ) : null}
          {mode === "login" || mode === "update" ? (
            <div className="space-y-2">
              <Label htmlFor="password">{mode === "update" ? "Yeni parola" : "Parola"}</Label>
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
              <Label htmlFor="confirm">Yeni parolayı tekrar yaz</Label>
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
              <Label htmlFor="code">Doğrulama kodu</Label>
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
              Parolamı unuttum
            </Link>
          ) : null}
          <Button type="submit" className="min-h-11 w-full" disabled={busy || !configured}>
            {busy ? "İşlem sürüyor…" : text.submit}
          </Button>
        </form>
        {mode === "login" ? (
          <Button
            onClick={google}
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={busy || !configured}
          >
            Google ile devam et
          </Button>
        ) : (
          <Link
            className="inline-block text-sm text-primary underline-offset-4 hover:underline"
            href={mode === "update" && notice ? "/" : "/giris"}
          >
            {mode === "update" && notice ? "Çalışma alanına git" : "Giriş ekranına dön"}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
