import { useRef, useState } from "react";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { AccountSessionView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { saveSessionLabel } from "./sessions";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function SessionLabel({
  session,
  onClose,
  onRefresh,
}: {
  session: AccountSessionView;
  onClose: (conflict?: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const intent = useRef<{ label: string; key: string } | undefined>(undefined);
  const form = useForm({
    defaultValues: { label: session.label ?? "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      setFailed(false);
      const label = value.label.trim();
      if (intent.current?.label !== label) intent.current = { label, key: uuidv7() };
      try {
        await saveSessionLabel({
          sessionId: session.session_id,
          version: session.version,
          label,
          operationKey: intent.current.key,
        });
        onClose();
        await onRefresh();
      } catch (error) {
        await onRefresh();
        if (error instanceof BackendError && error.code === "VERSION_CONFLICT") {
          onClose(true);
        } else {
          setFailed(true);
        }
      }
    },
  });
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(pending) => (
        <Dialog
          isOpen
          onOpenChange={(open) => {
            if (!open && !pending) onClose();
          }}
          isDismissable={!pending}
          isKeyboardDismissDisabled={pending}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>{t(($) => $.sessions.labelTitle)}</DialogTitle>
            <DialogDescription>{t(($) => $.sessions.labelDescription)}</DialogDescription>
          </DialogHeader>
          <form
            id="session-label"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.Field
                name="label"
                validators={{
                  onDynamic: z.string().refine(
                    (value) => Array.from(value.trim()).length <= 80,
                    t(($) => $.sessions.labelInvalid),
                  ),
                }}
              >
                {(field) => (
                  <Field
                    className="gap-1"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="session-label-input">
                      {t(($) => $.sessions.label)}
                    </FieldLabel>
                    <Input
                      id="session-label-input"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      disabled={pending}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "session-label-error" : undefined
                      }
                    />
                    <FieldError
                      id="session-label-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
          </form>
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.sessions.labelError)}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" isDisabled={pending} onPress={() => onClose()}>
              {t(($) => $.security.cancel)}
            </Button>
            <Button type="submit" form="session-label" isDisabled={pending}>
              {t(($) => $.sessions.save)}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </form.Subscribe>
  );
}
