import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import {
  previewInstructorRevocation,
  instructorRevocationIntent,
  revokeInstructor,
  type InstructorRevocationIntent,
} from "./instructor-revocation";
import type { StudioScope } from "./studio";
import type { InstructorRecord } from "./studio-reads";
import type { StudioSnapshot } from "./management-snapshot";
import type { InstructorRevocationPreview } from "../../lib/api-contracts/generated";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";

type Notice =
  | "ready"
  | "loading"
  | "read-error"
  | "unknown"
  | "stale"
  | "rejected"
  | "saved-unread";

export function InstructorRevoke({
  scope,
  target,
  onRefresh,
  onComplete,
  onLockChange,
  disabled: externallyDisabled = false,
}: {
  scope: StudioScope;
  target: InstructorRecord;
  onRefresh: () => Promise<StudioSnapshot>;
  onComplete: () => void;
  onLockChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>("ready");
  const [preview, setPreview] = useState<InstructorRevocationPreview>();
  const intent = useRef<InstructorRevocationIntent | undefined>(undefined);
  const accepted = useRef(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const formElement = useRef<HTMLFormElement>(null);
  const preventClose =
    (busy && notice !== "loading") || notice === "unknown" || notice === "saved-unread";
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onLockChange(preventClose);
    return () => onLockChange(false);
  }, [onLockChange, preventClose]);
  useBlocker({
    shouldBlockFn: () => lock.current || Boolean(intent.current) || accepted.current,
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });

  const form = useForm({
    formId: "instructor-role-revocation",
    defaultValues: { reason: "", accepted: false },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: z.object({
        reason: z
          .string()
          .trim()
          .min(
            1,
            t(($) => $.studio.revokeReasonRequired),
          ),
        accepted: z.boolean().refine(
          (value) => value,
          t(($) => $.studio.revokeAcceptanceRequired),
        ),
      }),
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async ({ value }) => {
      if (!preview || busy || notice !== "ready") return;
      await write(instructorRevocationIntent(scope, preview, value.reason));
    },
  });

  async function loadPreview() {
    if (lock.current || accepted.current || intent.current) return;
    lock.current = true;
    setOpen(true);
    setBusy(true);
    setNotice("loading");
    setPreview(undefined);
    form.reset({ reason: form.state.values.reason, accepted: false });
    try {
      const result = await previewInstructorRevocation(scope, target);
      if (mounted.current) {
        setPreview(result);
        setNotice("ready");
      }
    } catch {
      if (mounted.current) setNotice("read-error");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function reread() {
    const snapshot = await onRefresh();
    const current = snapshot.instructors.find((item) => item.assignmentId === target.assignmentId);
    if (!current || current.active) throw new Error("STUDIO_UNAVAILABLE");
    if (mounted.current) {
      setOpen(false);
      onComplete();
    }
  }

  async function retryRead() {
    if (lock.current || !accepted.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await reread();
    } catch {
      if (mounted.current) setNotice("saved-unread");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function write(next?: InstructorRevocationIntent) {
    if (lock.current || accepted.current) return;
    const current = next ?? intent.current;
    if (!current) return;
    intent.current = current;
    lock.current = true;
    setBusy(true);
    try {
      await revokeInstructor(current);
      accepted.current = true;
      intent.current = undefined;
      if (mounted.current) setNotice("saved-unread");
      await reread();
    } catch (error) {
      if (!mounted.current) return;
      if (accepted.current) setNotice("saved-unread");
      else if (
        error instanceof BackendError &&
        ["PREVIEW_STALE", "VERSION_CONFLICT"].includes(error.code)
      ) {
        intent.current = undefined;
        setPreview(undefined);
        form.setFieldValue("accepted", false);
        setNotice("stale");
      } else if (
        (error instanceof BackendError && error.code !== "TRANSPORT_ERROR" && !error.retryable) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        intent.current = undefined;
        setNotice("rejected");
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const message =
    notice === "loading"
      ? t(($) => $.studio.loading)
      : notice === "read-error"
        ? t(($) => $.studio.revokeReadError)
        : notice === "stale"
          ? t(($) => $.studio.revokeStale)
          : notice === "unknown"
            ? t(($) => $.studio.resourceUnknown)
            : notice === "saved-unread"
              ? t(($) => $.studio.revokeSavedUnread)
              : notice === "rejected"
                ? t(($) => $.studio.resourceRejected)
                : undefined;
  const disabled = busy || notice !== "ready" || !preview;
  return (
    <>
      <Button
        variant="destructive"
        isDisabled={externallyDisabled || !target.active || busy}
        onPress={() => {
          void loadPreview();
        }}
      >
        {t(($) => $.studio.revokeInstructor)}
      </Button>
      <Dialog
        isOpen={open}
        showCloseButton={false}
        isDismissable={!preventClose}
        isKeyboardDismissDisabled={preventClose}
        onOpenChange={(value) => {
          if (!preventClose) setOpen(value);
        }}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t(($) => $.studio.revokeInstructor)}</DialogTitle>
          <DialogDescription>
            {t(($) => $.studio.revokeDescription, { name: target.person.display_name })}
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <section aria-labelledby="instructor-revoke-impact">
            <h3 id="instructor-revoke-impact" className="mb-2 font-semibold">
              {t(($) => $.studio.affectedSessions)}
            </h3>
            {preview.sessions.length ? (
              <ItemGroup className="max-h-52 overflow-y-auto">
                {preview.sessions.map((session) => (
                  <Item key={session.session_id} role="listitem" variant="outline" size="xs">
                    <ItemContent>
                      <ItemTitle>
                        <time dateTime={session.starts_at}>
                          {new Intl.DateTimeFormat("tr-TR", {
                            timeZone: "UTC",
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(session.starts_at))}{" "}
                          UTC
                        </time>
                      </ItemTitle>
                      <ItemDescription>
                        {session.will_require_instructor
                          ? t(($) => $.studio.revokeNeedsInstructor)
                          : t(($) => $.studio.revokeOtherInstructorsRemain)}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <p className="text-muted-foreground">{t(($) => $.studio.revokeNoAffectedSessions)}</p>
            )}
          </section>
        )}
        <form
          ref={formElement}
          id="instructor-revoke-form"
          aria-label={t(($) => $.studio.revokeInstructor)}
          noValidate
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup className="gap-4">
            <p className="text-xs text-muted-foreground">{t(($) => $.studio.requiredFields)}</p>
            <form.Field name="reason">
              {(field) => (
                <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                  <FieldLabel htmlFor="instructor-revoke-reason">
                    {t(($) => $.studio.revokeReasonLabel)} <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Input
                    id="instructor-revoke-reason"
                    name="reason"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    required
                    disabled={disabled}
                    aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    aria-describedby={
                      field.state.meta.isTouched && !field.state.meta.isValid
                        ? "instructor-revoke-reason-error"
                        : undefined
                    }
                  />
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <FieldError
                      id="instructor-revoke-reason-error"
                      errors={field.state.meta.errors}
                    />
                  )}
                </Field>
              )}
            </form.Field>
            <form.Field name="accepted">
              {(field) => (
                <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      name="accepted"
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      isDisabled={disabled}
                      isRequired
                      aria-labelledby="instructor-revoke-accepted-label"
                      aria-describedby={
                        field.state.meta.isTouched && !field.state.meta.isValid
                          ? "instructor-revoke-accepted-error"
                          : "instructor-revoke-accepted-description"
                      }
                      isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    />
                    <div>
                      <FieldLabel id="instructor-revoke-accepted-label">
                        {t(($) => $.studio.revokeAcceptImpact)}
                      </FieldLabel>
                      <FieldDescription id="instructor-revoke-accepted-description" variant="hint">
                        {t(($) => $.studio.revokeSessionsKept)}
                      </FieldDescription>
                    </div>
                  </div>
                  {field.state.meta.isTouched && !field.state.meta.isValid && (
                    <FieldError
                      id="instructor-revoke-accepted-error"
                      errors={field.state.meta.errors}
                    />
                  )}
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </form>
        {message && (
          <Alert
            role="status"
            variant={notice === "loading" || notice === "saved-unread" ? "default" : "destructive"}
          >
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="flex-wrap">
          <Button
            autoFocus
            variant="outline"
            isDisabled={preventClose}
            onPress={() => setOpen(false)}
          >
            {t(($) => $.studio.cancel)}
          </Button>
          {notice === "unknown" ? (
            <Button
              isDisabled={busy}
              onPress={() => {
                void write();
              }}
            >
              {t(($) => $.studio.retrySameRequest)}
            </Button>
          ) : notice === "saved-unread" ? (
            <Button
              isDisabled={busy}
              onPress={() => {
                void retryRead();
              }}
            >
              {t(($) => $.studio.retryRead)}
            </Button>
          ) : ["stale", "read-error", "rejected"].includes(notice) ? (
            <Button
              isDisabled={busy}
              onPress={() => {
                void loadPreview();
              }}
            >
              {t(($) => $.studio.revokeReloadPreview)}
            </Button>
          ) : (
            <Button
              variant="destructive"
              type="submit"
              form="instructor-revoke-form"
              isDisabled={disabled}
            >
              {t(($) => $.studio.revokeConfirm)}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  );
}
