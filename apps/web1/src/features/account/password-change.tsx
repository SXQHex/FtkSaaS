import { useState } from "react";
import { XIcon } from "lucide-react";
import { isAuthError } from "@supabase/supabase-js";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { changePassword, requestPasswordCode } from "./password";
import { Button } from "../../components/ui/button";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";

type Failure = "needed" | "current" | "code" | "policy" | "unknown" | "send" | undefined;
export function PasswordChange({ onChanged }: { onChanged: () => Promise<void> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<Failure>();
  const schema = z
    .object({
      current: z.string(),
      password: z.string().min(
        1,
        t(($) => $.auth.requiredPassword),
      ),
      confirm: z.string().min(
        1,
        t(($) => $.auth.requiredPassword),
      ),
      nonce: z.string(),
    })
    .refine((value) => value.password === value.confirm, {
      path: ["confirm"],
      message: t(($) => $.auth.passwordMismatch),
    })
    .refine((value) => !needsCode || Boolean(value.nonce.trim()), {
      path: ["nonce"],
      message: t(($) => $.passwordChange.enterCode),
    });
  const form = useForm({
    defaultValues: { current: "", password: "", confirm: "", nonce: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: { onDynamic: schema },
    onSubmit: async ({ value }) => {
      setBusy(true);
      setFailure(undefined);
      try {
        await changePassword(value);
      } catch (error) {
        const code = isAuthError(error) ? error.code : undefined;
        if (
          value.nonce ||
          code === "reauthentication_needed" ||
          code === "reauthentication_not_valid"
        ) {
          setNeedsCode(true);
          setSent(false);
          form.setFieldValue("nonce", "");
        }
        setFailure(
          code === "reauthentication_needed"
            ? "needed"
            : code === "reauthentication_not_valid"
              ? "code"
              : code === "current_password_invalid" || code === "current_password_required"
                ? "current"
                : code === "weak_password" || code === "same_password"
                  ? "policy"
                  : "unknown",
        );
        setBusy(false);
        return;
      }
      form.reset();
      setNeedsCode(false);
      setSent(false);
      setOpen(false);
      await onChanged();
      setBusy(false);
    },
  });
  function toggle(next: boolean) {
    if (busy) return;
    form.reset();
    setFailure(undefined);
    setNeedsCode(false);
    setSent(false);
    setOpen(next);
  }
  async function send() {
    setBusy(true);
    setFailure(undefined);
    setSent(false);
    form.setFieldValue("nonce", "");
    try {
      await requestPasswordCode();
      setSent(true);
    } catch {
      setFailure("send");
    } finally {
      setBusy(false);
    }
  }
  const errors = {
    needed: t(($) => $.passwordChange.needed),
    current: t(($) => $.passwordChange.currentError),
    code: t(($) => $.passwordChange.codeError),
    policy: t(($) => $.passwordChange.policyError),
    unknown: t(($) => $.passwordChange.unknownError),
    send: t(($) => $.passwordChange.sendError),
  };
  const fields = [
    {
      name: "current",
      label: t(($) => $.passwordChange.current),
      autoComplete: "current-password",
    },
    { name: "password", label: t(($) => $.auth.newPassword), autoComplete: "new-password" },
    { name: "confirm", label: t(($) => $.passwordChange.confirm), autoComplete: "new-password" },
    ...(needsCode
      ? [
          {
            name: "nonce" as const,
            label: t(($) => $.passwordChange.code),
            autoComplete: "one-time-code",
          },
        ]
      : []),
  ] as const;
  return (
    <>
      <Button variant="outline" size="sm" isDisabled={busy} onPress={() => toggle(true)}>
        {t(($) => $.passwordChange.title)}
      </Button>
      <Sheet
        isOpen={open}
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
        showCloseButton={false}
        onOpenChange={toggle}
      >
        <SheetHeader className="flex-row items-start justify-between gap-3">
          <div>
            <SheetTitle>{t(($) => $.passwordChange.title)}</SheetTitle>
            <SheetDescription>{t(($) => $.passwordChange.description)}</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            isDisabled={busy}
            aria-label={t(($) => $.security.close)}
            onPress={() => toggle(false)}
          >
            <XIcon />
          </Button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <form
            id="password-change"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-3">
              {fields.map((descriptor) => (
                <form.Field key={descriptor.name} name={descriptor.name}>
                  {(field) => (
                    <Field
                      className="gap-1"
                      data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    >
                      <FieldLabel htmlFor={`password-change-${descriptor.name}`}>
                        {descriptor.label}
                      </FieldLabel>
                      <Input
                        id={`password-change-${descriptor.name}`}
                        name={descriptor.name}
                        type={descriptor.name === "nonce" ? "text" : "password"}
                        autoComplete={descriptor.autoComplete}
                        autoFocus={descriptor.name === "current"}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        disabled={busy}
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        aria-describedby={
                          [
                            descriptor.name === "current" ? "password-current-hint" : undefined,
                            field.state.meta.errors.length
                              ? `password-change-${descriptor.name}-error`
                              : undefined,
                          ]
                            .filter(Boolean)
                            .join(" ") || undefined
                        }
                      />
                      {descriptor.name === "current" && (
                        <FieldDescription id="password-current-hint">
                          {t(($) => $.passwordChange.firstPassword)}
                        </FieldDescription>
                      )}
                      <FieldError
                        id={`password-change-${descriptor.name}-error`}
                        errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                      />
                    </Field>
                  )}
                </form.Field>
              ))}
              {needsCode && (
                <>
                  <p>{t(($) => $.passwordChange.codeDescription)}</p>
                  <Button
                    variant="outline"
                    isDisabled={busy}
                    onPress={() => {
                      void send();
                    }}
                  >
                    {sent ? t(($) => $.passwordChange.resend) : t(($) => $.passwordChange.send)}
                  </Button>
                  {sent && <p role="status">{t(($) => $.passwordChange.sent)}</p>}
                </>
              )}
              {failure && (
                <Alert variant="destructive">
                  <AlertDescription>{errors[failure]}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </form>
        </div>
        <SheetFooter>
          <Button variant="outline" isDisabled={busy} onPress={() => toggle(false)}>
            {t(($) => $.security.cancel)}
          </Button>
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <Button
                type="submit"
                form="password-change"
                isDisabled={
                  busy ||
                  !values.password ||
                  values.password !== values.confirm ||
                  (needsCode && !values.nonce.trim())
                }
              >
                {t(($) => $.passwordChange.title)}
              </Button>
            )}
          </form.Subscribe>
        </SheetFooter>
      </Sheet>
    </>
  );
}
