import { useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthLayout } from "./auth-layout";
import { resendVerification } from "./verification";
import { Field, FieldError, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [requesting, setRequesting] = useState(false);
  const [result, setResult] = useState<"idle" | "sent" | "failed">("idle");
  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      setResult("idle");
      try {
        await resendVerification(value.email);
        setResult("sent");
      } catch {
        setResult("failed");
      }
    },
  });
  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1>{t(($) => $.auth.verifyEmailTitle)}</h1>
          <p className="mt-1 text-muted-foreground">{t(($) => $.auth.verifyEmailDescription)}</p>
        </div>
        {!requesting ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onPress={() => setRequesting(true)}>
              {t(($) => $.auth.resend)}
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-4">
              <form.Field
                name="email"
                validators={{ onDynamic: z.email(t(($) => $.auth.invalidEmail)) }}
              >
                {(field) => (
                  <Field
                    className="gap-1 pb-1"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="verify-email">{t(($) => $.auth.email)}</FieldLabel>
                    <Input
                      id="verify-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "verify-email-error" : undefined
                      }
                    />
                    <FieldError
                      id="verify-email-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(pending) => (
                  <Button variant="outline" type="submit" isDisabled={pending}>
                    {t(($) => $.auth.resend)}
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        )}
        {result !== "idle" && (
          <Alert
            role={result === "sent" ? "status" : "alert"}
            variant={result === "failed" ? "destructive" : "default"}
          >
            <AlertDescription>
              {result === "sent"
                ? t(($) => $.auth.verificationNotice)
                : t(($) => $.auth.recoveryError)}
            </AlertDescription>
          </Alert>
        )}
        <p>
          <a href="/login">{t(($) => $.auth.backLogin)}</a>
        </p>
      </div>
    </AuthLayout>
  );
}
