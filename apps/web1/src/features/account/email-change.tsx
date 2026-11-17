import { useState } from "react";
import { XIcon } from "lucide-react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { AccountIdentityView } from "../../lib/api-contracts/generated";
import { requestEmailChange, resendEmailChange } from "./email";
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
import { Skeleton } from "../../components/ui/skeleton";

export function EmailChange({
  disabled,
  onRefresh,
}: {
  disabled: boolean;
  onRefresh: () => Promise<AccountIdentityView | undefined>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState<AccountIdentityView>();
  const [readFailed, setReadFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<"requested" | "resent">();
  async function read() {
    setReadFailed(false);
    try {
      const next = await onRefresh();
      if (!next) throw new Error("IDENTITY_UNAVAILABLE");
      setIdentity(next);
    } catch {
      setReadFailed(true);
    }
  }
  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      if (busy || readFailed || !identity || result) return;
      setBusy(true);
      setFailed(false);
      try {
        await requestEmailChange(value.email);
        setResult("requested");
        form.reset();
      } catch {
        setFailed(true);
      }
      await read();
      setBusy(false);
    },
  });
  async function begin() {
    setOpen(true);
    setBusy(true);
    setIdentity(undefined);
    setResult(undefined);
    setFailed(false);
    form.reset();
    await read();
    setBusy(false);
  }
  function close(next: boolean) {
    if (busy || next) return;
    setOpen(false);
    setIdentity(undefined);
    setResult(undefined);
    setFailed(false);
    setReadFailed(false);
    form.reset();
  }
  async function resend() {
    if (!identity?.pending_email || readFailed || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await resendEmailChange(identity.pending_email);
      setResult("resent");
    } catch {
      setFailed(true);
    }
    await read();
    setBusy(false);
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-auto! self-start"
        isDisabled={disabled || busy}
        onPress={() => {
          void begin();
        }}
      >
        {t(($) => $.emailChange.title)}
      </Button>
      <Sheet
        isOpen={open}
        onOpenChange={close}
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
        showCloseButton={false}
      >
        <SheetHeader className="flex-row items-start justify-between gap-3">
          <div>
            <SheetTitle>{t(($) => $.emailChange.title)}</SheetTitle>
            <SheetDescription>{t(($) => $.emailChange.description)}</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            isDisabled={busy}
            aria-label={t(($) => $.security.close)}
            onPress={() => close(false)}
          >
            <XIcon />
          </Button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {busy && !identity && <Skeleton className="h-40 w-full" />}
          {identity && !readFailed && (
            <form
              id="email-change"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <FieldGroup className="gap-3">
                <Field className="gap-1">
                  <FieldLabel htmlFor="email-change-current">
                    {t(($) => $.emailChange.current)}
                  </FieldLabel>
                  <Input
                    id="email-change-current"
                    type="email"
                    readOnly
                    value={identity.email ?? ""}
                  />
                </Field>
                {identity.pending_email && (
                  <Field className="gap-1">
                    <FieldLabel htmlFor="email-change-pending">
                      {t(($) => $.emailChange.pending)}
                    </FieldLabel>
                    <Input
                      id="email-change-pending"
                      type="email"
                      readOnly
                      value={identity.pending_email}
                    />
                    <FieldDescription>{t(($) => $.emailChange.pendingHint)}</FieldDescription>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-auto! self-start"
                      isDisabled={busy}
                      onPress={() => {
                        void resend();
                      }}
                    >
                      {t(($) => $.emailChange.resend)}
                    </Button>
                  </Field>
                )}
                <form.Field
                  name="email"
                  validators={{
                    onDynamic: z
                      .string()
                      .trim()
                      .pipe(z.email(t(($) => $.auth.invalidEmail))),
                  }}
                >
                  {(field) => (
                    <Field
                      className="gap-1"
                      data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    >
                      <FieldLabel htmlFor="email-change-new">
                        {t(($) => $.emailChange.newEmail)}
                      </FieldLabel>
                      <Input
                        id="email-change-new"
                        autoFocus
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={field.state.value}
                        disabled={busy || Boolean(result)}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        aria-describedby={
                          field.state.meta.errors.length ? "email-change-error" : undefined
                        }
                      />
                      <FieldError
                        id="email-change-error"
                        errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                      />
                    </Field>
                  )}
                </form.Field>
              </FieldGroup>
            </form>
          )}
          {result && (
            <Alert role="status">
              <AlertDescription>
                {result === "requested"
                  ? t(($) => $.emailChange.requested)
                  : t(($) => $.emailChange.resent)}
              </AlertDescription>
            </Alert>
          )}
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.emailChange.error)}</AlertDescription>
            </Alert>
          )}
          {readFailed && (
            <Alert variant="destructive">
              <AlertDescription>
                {result ? t(($) => $.emailChange.acceptedReadError) : t(($) => $.profile.readError)}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => {
                    setBusy(true);
                    void read().finally(() => setBusy(false));
                  }}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" isDisabled={busy} onPress={() => close(false)}>
            {t(($) => $.security.close)}
          </Button>
          <Button
            type="submit"
            form="email-change"
            isDisabled={busy || readFailed || !identity || Boolean(result)}
          >
            {t(($) => $.emailChange.request)}
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}
