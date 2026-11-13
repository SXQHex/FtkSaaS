import { useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthLayout } from "./auth-layout";
import { requestPasswordReset } from "./password-recovery";
import { Field, FieldError, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      setFailed(false);
      try {
        await requestPasswordReset(value.email);
        setSent(true);
      } catch {
        setFailed(true);
      }
    },
  });
  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1>{sent ? t(($) => $.auth.checkEmail) : t(($) => $.auth.forgotTitle)}</h1>
          <p className="mt-1 text-muted-foreground" role={sent ? "status" : undefined}>
            {sent ? t(($) => $.auth.recoveryNotice) : t(($) => $.auth.forgotDescription)}
          </p>
        </div>
        {!sent && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
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
                    <FieldLabel htmlFor="recovery-email">{t(($) => $.auth.email)}</FieldLabel>
                    <Input
                      id="recovery-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "recovery-email-error" : undefined
                      }
                    />
                    <FieldError
                      id="recovery-email-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
              {failed && (
                <Alert variant="destructive">
                  <AlertDescription>{t(($) => $.auth.recoveryError)}</AlertDescription>
                </Alert>
              )}
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(pending) => (
                  <Button type="submit" isDisabled={pending}>
                    {t(($) => $.auth.sendLink)}
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        )}
        <p>
          <a href="/login">{t(($) => $.auth.backLogin)}</a>
        </p>
      </div>
    </AuthLayout>
  );
}
