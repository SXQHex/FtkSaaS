import { useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthLayout } from "./auth-layout";
import { saveRecoveredPassword } from "./password-recovery";
import { readAccount } from "../../lib/account";
import { Field, FieldError, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button, LinkButton } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [result, setResult] = useState<"editing" | "saved" | "saved-read-error">("editing");
  const [failed, setFailed] = useState(false);
  const schema = z
    .object({
      password: z.string().min(
        1,
        t(($) => $.auth.requiredPassword),
      ),
      confirm: z.string().min(
        1,
        t(($) => $.auth.requiredPassword),
      ),
    })
    .refine((value) => value.password === value.confirm, {
      path: ["confirm"],
      message: t(($) => $.auth.passwordMismatch),
    });
  const form = useForm({
    defaultValues: { password: "", confirm: "" },
    validationLogic: revalidateLogic({ mode: "submit", modeAfterSubmission: "change" }),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setFailed(false);
      try {
        await saveRecoveredPassword(value.password);
      } catch {
        setFailed(true);
        return;
      }
      setResult("saved");
      form.reset();
      try {
        await readAccount();
      } catch {
        setResult("saved-read-error");
      }
    },
  });
  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1>{t(($) => $.auth.resetTitle)}</h1>
          <p className="mt-1 text-muted-foreground">{t(($) => $.auth.resetDescription)}</p>
        </div>
        {result === "editing" ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-4">
              <form.Field name="password">
                {(field) => (
                  <Field
                    className="gap-1 pb-1"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="new-password">{t(($) => $.auth.newPassword)}</FieldLabel>
                    <Input
                      id="new-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "new-password-error" : undefined
                      }
                    />
                    <FieldError
                      id="new-password-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="confirm">
                {(field) => (
                  <Field
                    className="gap-1 pb-1"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="confirm-password">
                      {t(($) => $.auth.confirmPassword)}
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "confirm-password-error" : undefined
                      }
                    />
                    <FieldError
                      id="confirm-password-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
              {failed && (
                <Alert variant="destructive">
                  <AlertDescription>{t(($) => $.auth.passwordError)}</AlertDescription>
                </Alert>
              )}
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(pending) => (
                  <Button type="submit" isDisabled={pending}>
                    {t(($) => $.auth.savePassword)}
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        ) : (
          <>
            <Alert role="status">
              <AlertDescription>
                {result === "saved"
                  ? t(($) => $.auth.passwordSaved)
                  : t(($) => $.auth.passwordSavedReadError)}
              </AlertDescription>
            </Alert>
            <LinkButton href="/account">{t(($) => $.auth.account)}</LinkButton>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
