import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Field, FieldLabel } from "../../components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../components/ui/input-otp";
import { Button } from "../../components/ui/button";
import { getSupabaseClient } from "../../lib/supabase";
import { readAccount } from "../../lib/account";

export function MfaPage() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  async function verify() {
    setPending(true);
    setFailed(false);
    try {
      const { data, error } = await getSupabaseClient().auth.mfa.listFactors();
      if (error) throw error;
      const factor = data.totp.find((item) => item.status === "verified");
      if (!factor) throw new Error("MFA_FACTOR_REQUIRED");
      const result = await getSupabaseClient().auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (result.error) throw result.error;
      await readAccount();
      await navigate({ to: "/account", replace: true });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t(($) => $.auth.mfaTitle)}</CardTitle>
          <CardDescription>{t(($) => $.auth.mfaDescription)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="mfa-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <Field>
              <FieldLabel htmlFor="mfa-code">{t(($) => $.auth.mfaCode)}</FieldLabel>
              <InputOTP
                id="mfa-code"
                maxLength={6}
                minLength={6}
                required
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={setCode}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Field>
            {failed && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.auth.mfaError)}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          <Button form="mfa-form" type="submit" isDisabled={pending || code.length !== 6}>
            {t(($) => $.auth.verify)}
          </Button>
          <a href="/login">{t(($) => $.auth.backLogin)}</a>
        </CardFooter>
      </Card>
    </main>
  );
}
