// Adapted from @shadcn/login-02 (aria-rhea), installed with shadcn 4.23.0.
import { useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

export function LoginForm({
  onPassword,
  onGoogle,
}: {
  onPassword: (values: { email: string; password: string }) => Promise<void>;
  onGoogle: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const form = useForm({
    defaultValues: { email: "", password: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      setFailed(false);
      try {
        await onPassword(value);
      } catch {
        setFailed(true);
      }
    },
  });
  async function googleLogin() {
    setFailed(false);
    setGooglePending(true);
    try {
      await onGoogle();
    } catch {
      setFailed(true);
    } finally {
      setGooglePending(false);
    }
  }
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-4">
        <div>
          <h1>{t(($) => $.auth.loginTitle)}</h1>
          <p className="mt-1 text-muted-foreground">{t(($) => $.auth.loginDescription)}</p>
        </div>
        <form.Field name="email" validators={{ onDynamic: z.email(t(($) => $.auth.invalidEmail)) }}>
          {(field) => (
            <Field
              data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              className="gap-1 pb-1"
            >
              <FieldLabel htmlFor="email">{t(($) => $.auth.email)}</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="ad@ornek.test"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                aria-describedby={field.state.meta.errors.length ? "email-error" : undefined}
              />
              <FieldError
                id="email-error"
                errors={field.state.meta.isTouched ? field.state.meta.errors : []}
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="password"
          validators={{
            onDynamic: z.string().min(
              1,
              t(($) => $.auth.requiredPassword),
            ),
          }}
        >
          {(field) => (
            <Field
              data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              className="gap-1 pb-1"
            >
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="password">{t(($) => $.auth.password)}</FieldLabel>
                <a href="/forgot-password">{t(($) => $.auth.forgot)}</a>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                aria-describedby={field.state.meta.errors.length ? "password-error" : undefined}
              />
              <FieldError
                id="password-error"
                errors={field.state.meta.isTouched ? field.state.meta.errors : []}
              />
            </Field>
          )}
        </form.Field>
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.auth.loginError)}</AlertDescription>
          </Alert>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(pending) => (
            <Button type="submit" isDisabled={pending || googlePending}>
              {pending ? t(($) => $.auth.pending) : t(($) => $.auth.login)}
            </Button>
          )}
        </form.Subscribe>
        <FieldSeparator>{t(($) => $.auth.or)}</FieldSeparator>
        <Button
          variant="outline"
          type="button"
          isDisabled={googlePending}
          onPress={() => {
            void googleLogin();
          }}
        >
          {t(($) => $.auth.google)}
        </Button>
        <FieldDescription className="text-center">
          {t(($) => $.auth.noAccount)} <a href="/signup">{t(($) => $.auth.signup)}</a>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
