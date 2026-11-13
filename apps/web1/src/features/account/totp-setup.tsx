import { XIcon } from "lucide-react";
import { useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { enrollTotp, confirmTotpSetup } from "./security";
import { Button } from "../../components/ui/button";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Field, FieldGroup, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

type Enrollment = Awaited<ReturnType<typeof enrollTotp>>;
export function TotpSetup({
  onChanged,
  canStart = true,
}: {
  onChanged: () => Promise<void>;
  canStart?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const form = useForm({
    defaultValues: { code: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      if (!enrollment) return;
      setBusy(true);
      setFailed(false);
      try {
        await confirmTotpSetup(enrollment.id, value.code);
        setEnrollment(undefined);
        form.reset();
        setOpen(false);
        await onChanged();
      } catch {
        setFailed(true);
        await onChanged();
      } finally {
        setBusy(false);
      }
    },
  });
  async function begin() {
    setOpen(true);
    setBusy(true);
    setFailed(false);
    form.reset();
    try {
      setEnrollment(await enrollTotp());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setFailed(false);
    try {
      setEnrollment(undefined);
      form.reset();
      setOpen(false);
      await onChanged();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {canStart && (
        <Button
          variant="outline"
          size="sm"
          onPress={() => {
            void begin();
          }}
        >
          {t(($) => $.security.setup)}
        </Button>
      )}
      <Sheet
        isOpen={open}
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
        onOpenChange={(next) => {
          if (!next && !busy) void cancel();
        }}
        showCloseButton={false}
      >
        <SheetHeader className="flex-row items-start justify-between gap-3">
          <div>
            <SheetTitle>{t(($) => $.security.setupTitle)}</SheetTitle>
            <SheetDescription>{t(($) => $.security.setupDescription)}</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            isDisabled={busy}
            aria-label={t(($) => $.security.close)}
            onPress={() => {
              void cancel();
            }}
          >
            <XIcon />
          </Button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {enrollment ? (
            <form
              id="totp-setup"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FieldGroup className="gap-8">
                <div className="flex flex-wrap items-start gap-4">
                  <img
                    src={enrollment.totp.qr_code}
                    alt={t(($) => $.security.qrAlt)}
                    className="size-33 rounded-md border bg-white p-2"
                  />
                  <div className="min-w-40 flex-1">
                    <p className="text-muted-foreground">{t(($) => $.security.scan)}</p>
                    <code className="mt-2 block break-all rounded-md border p-2">
                      {enrollment.totp.secret}
                    </code>
                  </div>
                </div>
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
                      className="gap-1"
                      data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    >
                      <FieldLabel htmlFor="setup-code">{t(($) => $.security.setupCode)}</FieldLabel>
                      <Input
                        id="setup-code"
                        autoFocus
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        disabled={busy}
                        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        aria-describedby={
                          field.state.meta.errors.length ? "setup-code-error" : undefined
                        }
                      />
                      <FieldError
                        id="setup-code-error"
                        errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                      />
                    </Field>
                  )}
                </form.Field>
              </FieldGroup>
            </form>
          ) : busy ? (
            <Skeleton className="h-36 w-full" />
          ) : null}
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.security.setupError)}</AlertDescription>
            </Alert>
          )}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            isDisabled={busy}
            onPress={() => {
              void cancel();
            }}
          >
            {t(($) => $.security.cancel)}
          </Button>
          {enrollment && (
            <Button type="submit" form="totp-setup" isDisabled={busy}>
              {t(($) => $.security.verifyCode)}
            </Button>
          )}
        </SheetFooter>
      </Sheet>
    </>
  );
}
