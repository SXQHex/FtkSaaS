import { useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthLayout } from "./auth-layout";
import { continueAfterMfa, verifyTotp } from "./mfa";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";

export function MfaPage() {
  const factors = useLoaderData({ from: "/mfa" });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [reading, setReading] = useState(false);
  async function continueToAccount() {
    setReading(true);
    setFailed(false);
    try {
      await navigate({ to: await continueAfterMfa(), replace: true });
    } catch {
      setFailed(true);
    } finally {
      setReading(false);
    }
  }
  const form = useForm({
    defaultValues: { code: "", factorId: factors.length === 1 ? factors[0].id : "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      setFailed(false);
      try {
        await verifyTotp(value.factorId, value.code);
        setVerified(true);
        form.reset();
        await continueToAccount();
      } catch {
        setFailed(true);
      }
    },
  });
  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1>{t(($) => $.auth.mfaTitle)}</h1>
          <p className="mt-1 text-muted-foreground">{t(($) => $.auth.mfaDescription)}</p>
        </div>
        {factors.length === 0 ? (
          <Alert>
            <AlertDescription>{t(($) => $.auth.mfaNoFactor)}</AlertDescription>
          </Alert>
        ) : verified ? (
          <div className="flex flex-col gap-4">
            {failed && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.auth.mfaReadError)}</AlertDescription>
              </Alert>
            )}
            <Button
              isDisabled={reading}
              onPress={() => {
                void continueToAccount();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-4">
              {factors.length > 1 && (
                <form.Field
                  name="factorId"
                  validators={{
                    onDynamic: z.string().min(
                      1,
                      t(($) => $.auth.mfaChooseFactor),
                    ),
                  }}
                >
                  {(field) => (
                    <Field
                      className="gap-1"
                      data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    >
                      <FieldLabel htmlFor="mfa-factor">{t(($) => $.auth.mfaFactor)}</FieldLabel>
                      <NativeSelect
                        id="mfa-factor"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        aria-describedby={
                          field.state.meta.errors.length ? "mfa-factor-error" : undefined
                        }
                      >
                        <NativeSelectOption value="">
                          {t(($) => $.auth.mfaChooseFactor)}
                        </NativeSelectOption>
                        {factors.map((factor, index) => (
                          <NativeSelectOption key={factor.id} value={factor.id}>
                            {factor.friendly_name ||
                              t(($) => $.auth.mfaFactorNumber, { number: index + 1 })}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <FieldError
                        id="mfa-factor-error"
                        errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                      />
                    </Field>
                  )}
                </form.Field>
              )}
              <form.Field
                name="code"
                validators={{
                  onDynamic: z.string().regex(
                    /^\d{6}$/,
                    t(($) => $.auth.mfaCodeInvalid),
                  ),
                }}
              >
                {(field) => (
                  <Field
                    className="gap-1 pb-1"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="mfa-code">{t(($) => $.auth.mfaCode)}</FieldLabel>
                    <Input
                      id="mfa-code"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "mfa-code-error" : undefined
                      }
                    />
                    <FieldError
                      id="mfa-code-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
              {failed && (
                <Alert variant="destructive">
                  <AlertDescription>{t(($) => $.auth.mfaError)}</AlertDescription>
                </Alert>
              )}
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(pending) => (
                  <Button type="submit" isDisabled={pending}>
                    {t(($) => $.auth.verify)}
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

export function MfaErrorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <h1>{t(($) => $.auth.mfaTitle)}</h1>
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.auth.mfaLoadError)}</AlertDescription>
        </Alert>
        <Button
          onPress={() => {
            void router.invalidate();
          }}
        >
          {t(($) => $.auth.retry)}
        </Button>
        <a href="/login">{t(($) => $.auth.backLogin)}</a>
      </div>
    </AuthLayout>
  );
}
