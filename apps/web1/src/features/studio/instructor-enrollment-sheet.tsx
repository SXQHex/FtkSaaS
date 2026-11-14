import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { XIcon } from "lucide-react";
import { BackendError } from "../../lib/backend";
import type { JobRef, JobStatusView } from "../../lib/api-contracts/generated";
import type { StudioScope } from "./studio";
import {
  enrollmentIntent,
  readInstructorEnrollment,
  readInstructorInvitationJob,
  writeInstructorEnrollment,
  type EnrollmentIntent,
  type EnrollmentReceipt,
  type InstructorEnrollment,
} from "./instructor-enrollment";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetFooter,
} from "../../components/ui/sheet";
import { Field, FieldLabel, FieldDescription, FieldError } from "../../components/ui/field";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";

type Notice = "loading" | "ready" | "read-error" | "rejected" | "unknown" | "saved-unread";

export function InstructorEnrollmentSheet({
  scope,
  personId,
  initialJob,
  onJob,
  onReady,
  onChooseAnother,
  onClose,
  onLockChange,
}: {
  scope: StudioScope;
  personId: string;
  initialJob?: JobRef;
  onJob: (job: JobRef) => void;
  onReady: (personId: string, isCurrent: () => boolean) => Promise<void>;
  onChooseAnother: () => void;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<InstructorEnrollment>();
  const [notice, setNotice] = useState<Notice>("loading");
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [job, setJob] = useState(initialJob);
  const [jobStatus, setJobStatus] = useState<JobStatusView>();
  const [jobError, setJobError] = useState(false);
  const [changedAfterWrite, setChangedAfterWrite] = useState(false);
  const [failureCode, setFailureCode] = useState<string>();
  const pending = useRef<EnrollmentIntent | undefined>(undefined);
  const receipt = useRef<EnrollmentReceipt | undefined>(undefined);
  const lock = useRef(false);
  const mounted = useRef(true);
  const formElement = useRef<HTMLFormElement>(null);
  const preventClose = mutating || notice === "unknown" || notice === "saved-unread";
  const canAct = !busy && notice === "ready" && Boolean(state);
  const { accountId, orgId, centerId } = scope;
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void readInstructorEnrollment({ accountId, orgId, centerId }, personId)
      .then((next) => {
        if (active && mounted.current) {
          setState(next);
          setNotice("ready");
        }
      })
      .catch(() => {
        if (active && mounted.current) setNotice("read-error");
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [accountId, orgId, centerId, personId]);
  useEffect(() => {
    onLockChange(preventClose);
    return () => onLockChange(false);
  }, [preventClose, onLockChange]);
  useBlocker({
    shouldBlockFn: () => lock.current || Boolean(pending.current) || Boolean(receipt.current),
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });
  const form = useForm({
    formId: "instructor-role-grant",
    defaultValues: { accepted: false },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: z.object({
        accepted: z.boolean().refine(
          (value) => value,
          t(($) => $.studio.grantAcceptanceRequired),
        ),
      }),
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async () => {
      if (canAct && state && state.activeLink !== false) await start("grant");
    },
  });
  function close() {
    if (preventClose || pending.current || receipt.current) return;
    mounted.current = false;
    onClose();
  }
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setFailureCode(undefined);
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (!mounted.current) return;
      if (receipt.current) setNotice("saved-unread");
      else if (!pending.current) {
        setState(undefined);
        setNotice("read-error");
      } else if (
        (error instanceof BackendError && error.code !== "TRANSPORT_ERROR" && !error.retryable) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        pending.current = undefined;
        if (error instanceof BackendError) setFailureCode(error.code);
        form.reset({ accepted: false });
        setNotice("rejected");
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setMutating(false);
      }
    }
  }
  async function finishRead() {
    const next = await readInstructorEnrollment(scope, personId);
    if (!mounted.current) return;
    setState(next);
    form.reset({ accepted: false });
    const accepted = receipt.current;
    if (accepted?.kind === "grant") {
      if (
        next.activeLink !== true ||
        !next.roles.some(
          (role) =>
            role.assignmentId === accepted.roleId &&
            role.active &&
            role.accountAccessGranted === true,
        )
      ) {
        // The acknowledged operation is historical fact; a later removal must
        // be shown as current state, never retried as another role grant.
        pending.current = undefined;
        receipt.current = undefined;
        setChangedAfterWrite(true);
        setNotice("ready");
        return;
      }
      await onReady(personId, () => mounted.current);
      return;
    }
    pending.current = undefined;
    receipt.current = undefined;
    setNotice("ready");
  }
  async function perform() {
    const current = pending.current;
    if (!current || receipt.current) return;
    setMutating(true);
    const accepted = await writeInstructorEnrollment(current);
    receipt.current = accepted;
    pending.current = undefined;
    if (!mounted.current) return;
    if (accepted.kind === "invite") {
      setJob(accepted.job);
      setJobStatus(undefined);
      setJobError(false);
      onJob(accepted.job);
    }
    setNotice("saved-unread");
    await finishRead();
  }
  async function start(kind: EnrollmentIntent["kind"]) {
    await run(async () => {
      setChangedAfterWrite(false);
      const fresh = await readInstructorEnrollment(scope, personId);
      if (!mounted.current) return;
      setState(fresh);
      if (
        (kind === "invite" && fresh.activeLink === true) ||
        (kind === "grant" && fresh.activeLink === false)
      ) {
        form.reset({ accepted: false });
        setNotice("ready");
        return;
      }
      pending.current = enrollmentIntent(fresh, kind);
      await perform();
    });
  }
  async function refresh() {
    await run(async () => {
      if (receipt.current) {
        await finishRead();
        return;
      }
      if (pending.current) return;
      await finishRead();
    });
  }
  async function checkJob() {
    if (!job) return;
    await run(async () => {
      try {
        const next = await readInstructorInvitationJob(scope, job.job_id);
        if (mounted.current) {
          setJobStatus(next);
          setJobError(false);
        }
      } catch {
        if (mounted.current) setJobError(true);
      }
    });
  }
  const message =
    notice === "loading"
      ? t(($) => $.studio.loading)
      : notice === "read-error"
        ? t(($) => $.studio.resourceReadError)
        : notice === "unknown"
          ? t(($) => $.studio.resourceUnknown)
          : notice === "saved-unread"
            ? t(($) => $.studio.enrollmentSavedUnread)
            : notice === "rejected"
              ? failureCode === "ACCOUNT_LINK_REQUIRED"
                ? t(($) => $.studio.invitationRequired)
                : failureCode === "ACCOUNT_ALREADY_LINKED"
                  ? t(($) => $.studio.enrollmentAlreadyLinked)
                  : t(($) => $.studio.enrollmentRejected)
              : undefined;
  const delivery = jobStatus?.email_delivery?.state;
  const adverseDelivery =
    delivery === "bounced" || delivery === "complained" || delivery === "failed";
  const adverse =
    adverseDelivery || jobStatus?.state === "failed" || jobStatus?.state === "cancelled";
  return (
    <Sheet
      isOpen
      showCloseButton={false}
      isDismissable={!preventClose}
      isKeyboardDismissDisabled={preventClose}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetHeader className="relative pr-14">
        <SheetTitle>{t(($) => $.studio.enrollmentTitle)}</SheetTitle>
        <SheetDescription>{t(($) => $.studio.enrollmentDescription)}</SheetDescription>
        <SheetClose
          className="absolute top-4 right-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.studio.close)}
          isDisabled={preventClose}
        >
          <XIcon />
        </SheetClose>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-busy={busy}>
        {!state && notice === "loading" && <Skeleton className="h-24 w-full" />}
        {state && (
          <>
            <p className="font-semibold">{state.person.display_name}</p>
            <Button
              className="h-auto min-h-8 max-w-full whitespace-normal"
              variant="outline"
              isDisabled={busy || preventClose}
              onPress={onChooseAnother}
            >
              {t(($) => $.studio.chooseAnotherPerson)}
            </Button>
            <ol aria-label={t(($) => $.studio.enrollmentSteps)} className="flex flex-col gap-3">
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>{t(($) => $.studio.personRecordStep)}</span>
                <Badge variant="outline">{t(($) => $.studio.complete)}</Badge>
              </li>
              <li
                aria-current={state.activeLink !== true ? "step" : undefined}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>{t(($) => $.studio.accountLinkStep)}</span>
                <Badge variant="outline">
                  {state.activeLink === true
                    ? t(($) => $.studio.accountLinkFound)
                    : state.activeLink === null
                      ? t(($) => $.studio.linkUnknown)
                      : t(($) => $.studio.pending)}
                </Badge>
              </li>
              <li
                aria-current={state.activeLink === true && !state.activeRole ? "step" : undefined}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>{t(($) => $.studio.instructorRoleStep)}</span>
                <Badge variant="outline">
                  {state.accountAccessGranted === true
                    ? t(($) => $.studio.instructorAccountAccessGranted)
                    : state.activeRole
                      ? t(($) => $.studio.instructorDutyActive)
                      : t(($) => $.studio.pending)}
                </Badge>
              </li>
            </ol>
            {state.activeLink !== true && (
              <Alert>
                <AlertDescription className="flex flex-col items-start gap-3">
                  {state.activeLink === null
                    ? t(($) => $.studio.linkDiscoveryUnavailable)
                    : t(($) => $.studio.invitationRequired)}
                  {state.pendingInvitations > 0 && (
                    <p>{t(($) => $.studio.invitationResendWarning)}</p>
                  )}
                  <Button
                    className="h-auto min-h-8 max-w-full whitespace-normal"
                    isDisabled={!canAct}
                    onPress={() => {
                      void start("invite");
                    }}
                  >
                    {state.pendingInvitations
                      ? t(($) => $.studio.resendInstructorInvitation)
                      : t(($) => $.studio.sendInstructorInvitation)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="h-auto min-h-8 max-w-full whitespace-normal"
              variant="outline"
              isDisabled={
                busy || notice === "unknown" || notice === "saved-unread" || notice === "loading"
              }
              onPress={() => {
                void refresh();
              }}
            >
              {t(($) => $.studio.checkAccountLink)}
            </Button>
            {state.activeRole && state.accountAccessGranted !== true && (
              <p className="text-sm text-muted-foreground">
                {t(($) => $.studio.existingInstructorDutyHint)}
              </p>
            )}
            {state.activeLink !== false && state.accountAccessGranted !== true && (
              <form
                id="instructor-role-grant"
                ref={formElement}
                aria-label={t(($) => $.studio.grantInstructorRole)}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
              >
                <form.Field name="accepted">
                  {(field) => (
                    <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="instructor-grant"
                          name="accepted"
                          aria-labelledby="instructor-grant-label"
                          isRequired
                          isSelected={field.state.value}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                          isDisabled={!canAct}
                          isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                          aria-describedby={
                            field.state.meta.isTouched && !field.state.meta.isValid
                              ? "instructor-grant-error"
                              : "instructor-grant-description"
                          }
                        >
                          <span className="sr-only">{t(($) => $.studio.acceptInstructorRole)}</span>
                        </Checkbox>
                        <div>
                          <FieldLabel id="instructor-grant-label" htmlFor="instructor-grant">
                            {t(($) => $.studio.acceptInstructorRole)}
                          </FieldLabel>
                          <FieldDescription id="instructor-grant-description" variant="hint">
                            {t(($) => $.studio.instructorRoleAccessDescription)}
                          </FieldDescription>
                        </div>
                      </div>
                      {field.state.meta.isTouched && !field.state.meta.isValid && (
                        <FieldError id="instructor-grant-error" errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )}
                </form.Field>
                {state.activeRole && (
                  <Button
                    className="mt-3 h-auto min-h-8 max-w-full whitespace-normal"
                    type="submit"
                    isDisabled={!canAct}
                  >
                    {t(($) => $.studio.applyLinkedInstructorRole)}
                  </Button>
                )}
              </form>
            )}
          </>
        )}
        {changedAfterWrite && (
          <Alert role="status">
            <AlertDescription>{t(($) => $.studio.enrollmentChangedAfterWrite)}</AlertDescription>
          </Alert>
        )}
        {job && (
          <Alert role="status" variant={adverse ? "destructive" : "default"}>
            <AlertDescription className="flex flex-col items-start gap-3">
              <p>
                {adverseDelivery && delivery
                  ? t(($) => $.studio.invitationDeliveryStates[delivery])
                  : t(($) => $.studio.invitationJobStates[jobStatus?.state ?? job.state])}
              </p>
              {delivery && !adverse && (
                <p>{t(($) => $.studio.invitationDeliveryStates[delivery])}</p>
              )}
              <p>{t(($) => $.studio.invitationEvidenceHint)}</p>
              {jobError && <p>{t(($) => $.studio.invitationJobReadError)}</p>}
              <Button
                className="h-auto min-h-8 max-w-full whitespace-normal"
                variant="outline"
                isDisabled={busy || notice === "unknown" || notice === "saved-unread"}
                onPress={() => {
                  void checkJob();
                }}
              >
                {t(($) => $.studio.checkInvitationJob)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert
            role="status"
            variant={notice === "loading" || notice === "saved-unread" ? "default" : "destructive"}
          >
            <AlertDescription className="flex flex-col items-start gap-3">
              {message}
              {notice === "unknown" ? (
                <Button
                  className="h-auto min-h-8 max-w-full whitespace-normal"
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => {
                    void run(perform);
                  }}
                >
                  {t(($) => $.studio.retrySameRequest)}
                </Button>
              ) : (
                ["read-error", "rejected", "saved-unread"].includes(notice) && (
                  <Button
                    className="h-auto min-h-8 max-w-full whitespace-normal"
                    variant="outline"
                    isDisabled={busy}
                    onPress={() => {
                      void refresh();
                    }}
                  >
                    {t(($) => $.studio.retryRead)}
                  </Button>
                )
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          className="h-auto min-h-8 max-w-full whitespace-normal"
          autoFocus
          variant="outline"
          isDisabled={preventClose}
          onPress={close}
        >
          {t(($) => $.studio.close)}
        </Button>
        {state?.activeRole ? (
          <Button
            className="h-auto min-h-8 max-w-full whitespace-normal"
            isDisabled={!canAct}
            onPress={() => {
              void run(async () => {
                const fresh = await readInstructorEnrollment(scope, personId);
                if (!mounted.current) return;
                setState(fresh);
                if (fresh.activeRole) await onReady(personId, () => mounted.current);
              });
            }}
          >
            {t(($) => $.studio.editInstructorClasses)}
          </Button>
        ) : (
          <Button
            className="h-auto min-h-8 max-w-full whitespace-normal"
            type="submit"
            form="instructor-role-grant"
            isDisabled={!canAct || !state || state.activeLink === false}
          >
            {t(($) => $.studio.grantInstructorRole)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
