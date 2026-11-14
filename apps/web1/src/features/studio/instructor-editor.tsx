import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { XIcon } from "lucide-react";
import { BackendError } from "../../lib/backend";
import {
  instructorEditDraft,
  instructorClassesChanged,
  instructorEditIntent,
  instructorEditSchema,
  loadInstructorEditor,
  saveInstructorEditStep,
  type InstructorEditIntent,
  type InstructorEditState,
} from "./instructor-edit";
import { InstructorRevoke } from "./instructor-revoke";
import { StudioSheets } from "./studio-sheets";
import type { StudioScope } from "./studio";
import type { StudioViewData } from "./studio-view";
import type { StudioSnapshot } from "./management-snapshot";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle } from "../../components/ui/item";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

type Notice = "ready" | "saved" | "unknown" | "conflict" | "rejected" | "saved-unread";

export function StudioInstructorEditor({
  scope,
  personId,
  previewData,
  onRefresh,
  onObserved,
  onClose,
  onLockChange,
}: {
  scope: StudioScope;
  personId: string;
  previewData: StudioViewData;
  onRefresh: () => Promise<StudioSnapshot>;
  onObserved: (state: InstructorEditState) => void;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [initial, setInitial] = useState<InstructorEditState>();
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState(false);
  const mounted = useRef(true);
  const { accountId, orgId, centerId } = scope;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Every opened editor starts with a new exact read, independently of the
    // summary's display cache. A cached prior edit cannot become its write base.
    void loadInstructorEditor({ accountId, orgId, centerId }, personId)
      .then((state) => {
        if (!active) return;
        setInitial(state);
        onObserved(state);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [accountId, orgId, centerId, personId, onObserved]);
  async function retryInitial() {
    if (reading) return;
    setReading(true);
    setFailed(false);
    try {
      const state = await loadInstructorEditor(scope, personId);
      if (mounted.current) {
        setInitial(state);
        onObserved(state);
      }
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setReading(false);
    }
  }
  if (!initial)
    return (
      <StudioSheets
        selection={{ kind: "instructor", id: personId }}
        data={previewData}
        onClose={onClose}
        readOnlyInstructor
        instructorNotice={
          failed ? t(($) => $.studio.resourceReadError) : t(($) => $.studio.loading)
        }
        footerActions={
          failed && (
            <Button
              variant="outline"
              isDisabled={reading}
              onPress={() => {
                void retryInitial();
              }}
            >
              {t(($) => $.studio.retry)}
            </Button>
          )
        }
      />
    );
  return (
    <InstructorEditForm
      initial={initial}
      scope={scope}
      onClose={onClose}
      onLockChange={onLockChange}
      onRefresh={async () => {
        await onRefresh();
        const result = await loadInstructorEditor(scope, personId);
        if (mounted.current) onObserved(result);
        return result;
      }}
      onRoleRefresh={onRefresh}
    />
  );
}

function InstructorEditForm({
  initial,
  scope,
  onRefresh,
  onRoleRefresh,
  onClose,
  onLockChange,
}: {
  initial: InstructorEditState;
  scope: StudioScope;
  onRefresh: () => Promise<InstructorEditState>;
  onRoleRefresh: () => Promise<StudioSnapshot>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [base, setBase] = useState(initial);
  const [notice, setNotice] = useState<Notice>("ready");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [plan, setPlan] = useState<InstructorEditIntent["steps"]>([]);
  const queue = useRef<{ intent: InstructorEditIntent; next: number } | undefined>(undefined);
  const accepted = useRef(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const formElement = useRef<HTMLFormElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const preventClose = busy || notice === "unknown" || notice === "saved-unread";
  const disabled = busy || !["ready", "saved"].includes(notice);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onLockChange(preventClose);
    return () => onLockChange(false);
  }, [preventClose, onLockChange]);
  useBlocker({
    shouldBlockFn: () => lock.current || Boolean(queue.current),
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });
  useLayoutEffect(() => {
    if (busy || !previousFocus.current) return;
    const previous = previousFocus.current;
    previousFocus.current = null;
    if (document.activeElement !== document.body) return;
    const target =
      previous.isConnected && !previous.matches(":disabled")
        ? previous
        : formElement.current?.querySelector<HTMLElement>(
            "[data-instructor-recovery]:not(:disabled), #instructor-name:not(:disabled)",
          );
    target?.focus();
  }, [busy, disabled, notice]);
  const form = useForm({
    formId: "studio-instructor-profile",
    defaultValues: instructorEditDraft(base),
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: instructorEditSchema(base, {
        name: t(($) => $.studio.nameRequired),
        email: t(($) => $.studio.instructorEmailInvalid),
        impact: t(($) => $.studio.instructorImpactRequired),
      }),
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async ({ value }) => {
      if (disabled || lock.current) return;
      previousFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setCompleted(0);
      setPlan([]);
      try {
        const intent = instructorEditIntent(scope, base, value);
        if (!intent.steps.length) {
          form.reset(instructorEditDraft(base));
          setNotice("ready");
          return;
        }
        queue.current = { intent, next: 0 };
        setPlan(intent.steps);
        setCompleted(0);
        await write();
      } catch {
        setNotice("rejected");
      }
    },
  });

  function draftChanged() {
    if (notice === "saved") {
      setNotice("ready");
      setCompleted(0);
    }
  }

  async function reload() {
    if (lock.current) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lock.current = true;
    setBusy(true);
    try {
      const next = await onRefresh();
      if (!mounted.current) return;
      setBase(next);
      form.reset(instructorEditDraft(next));
      setPlan([]);
      queue.current = undefined;
      accepted.current = false;
      setCompleted(0);
      setNotice("ready");
    } catch {
      if (mounted.current) setNotice(accepted.current ? "saved-unread" : "rejected");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reread() {
    const next = await onRefresh();
    if (!mounted.current) return;
    setBase(next);
    form.reset(instructorEditDraft(next));
    setPlan([]);
    queue.current = undefined;
    accepted.current = false;
    setNotice("saved");
  }
  async function retryRead() {
    if (lock.current || !accepted.current) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
  async function write() {
    const current = queue.current;
    if (lock.current || !current || accepted.current) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lock.current = true;
    setBusy(true);
    try {
      while (current.next < current.intent.steps.length) {
        await saveInstructorEditStep(current.intent, current.next);
        current.next++;
        if (!mounted.current) return;
        setCompleted(current.next);
      }
      accepted.current = true;
      setNotice("saved-unread");
      await reread();
    } catch (error) {
      if (!mounted.current) return;
      if (accepted.current) setNotice("saved-unread");
      else if (error instanceof BackendError && error.code === "VERSION_CONFLICT")
        setNotice("conflict");
      else if (
        (error instanceof BackendError && error.code !== "TRANSPORT_ERROR" && !error.retryable) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      )
        setNotice("rejected");
      else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const active = base.roles.some((item) => item.active);
  const target = base.roles.find((item) => item.active) ?? base.roles[0];
  const canAssign = active && base.assignments !== null;
  const message =
    notice === "saved"
      ? t(($) => $.studio.instructorSaved)
      : notice === "unknown"
        ? t(($) => $.studio.resourceUnknown)
        : notice === "conflict"
          ? t(($) => $.studio.instructorConflict)
          : notice === "rejected"
            ? t(($) => $.studio.instructorRejected)
            : notice === "saved-unread"
              ? t(($) => $.studio.instructorSavedUnread)
              : undefined;
  return (
    <Sheet
      isOpen
      showCloseButton={false}
      isDismissable={!preventClose}
      isKeyboardDismissDisabled={preventClose}
      onOpenChange={(value) => {
        if (!value && !preventClose) onClose();
      }}
    >
      <SheetHeader className="relative pr-14">
        <SheetTitle>{t(($) => $.studio.editInstructor)}</SheetTitle>
        <SheetDescription>{t(($) => $.studio.sheetDescription)}</SheetDescription>
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
      <form
        id="studio-instructor-profile"
        ref={formElement}
        aria-label={t(($) => $.studio.editInstructor)}
        aria-busy={busy}
        noValidate
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup className="gap-4">
          <p className="text-xs text-muted-foreground">{t(($) => $.studio.requiredFields)}</p>
          <form.Field name="name">
            {(field) => (
              <Field
                className="gap-1.5"
                data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              >
                <FieldLabel htmlFor="instructor-name">
                  {t(($) => $.studio.fullName)} <span aria-hidden="true">*</span>
                </FieldLabel>
                <Input
                  id="instructor-name"
                  name="name"
                  autoComplete="name"
                  required
                  disabled={disabled}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    draftChanged();
                    field.handleChange(event.target.value);
                  }}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  aria-describedby={
                    field.state.meta.isTouched && !field.state.meta.isValid
                      ? "instructor-name-error"
                      : undefined
                  }
                />
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <FieldError id="instructor-name-error" errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <Field
                className="gap-1.5"
                data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
              >
                <FieldLabel htmlFor="instructor-email">{t(($) => $.studio.email)}</FieldLabel>
                <Input
                  id="instructor-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  disabled={disabled || !base.person.contacts}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    draftChanged();
                    field.handleChange(event.target.value);
                  }}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  aria-describedby={
                    field.state.meta.isTouched && !field.state.meta.isValid
                      ? "instructor-email-error instructor-email-hint"
                      : "instructor-email-hint"
                  }
                />
                <FieldDescription id="instructor-email-hint" variant="hint">
                  {base.person.contacts
                    ? t(($) => $.studio.instructorContactHint)
                    : t(($) => $.studio.instructorContactUnavailable)}
                </FieldDescription>
                {field.state.meta.isTouched && !field.state.meta.isValid && (
                  <FieldError id="instructor-email-error" errors={field.state.meta.errors} />
                )}
              </Field>
            )}
          </form.Field>
          <form.Field name="classIds">
            {(field) => (
              <FieldSet className="gap-3">
                <FieldLegend variant="label">{t(($) => $.studio.teachingDisciplines)}</FieldLegend>
                {base.assignments === null ? (
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.classAssignmentsUnknown)}
                  </FieldDescription>
                ) : (
                  <ItemGroup>
                    {base.classes
                      .filter((item) => item.active)
                      .map((lesson) => (
                        <Item
                          key={lesson.id}
                          role="listitem"
                          variant="outline"
                          size="xs"
                          className="rounded-lg px-3.5 py-2.5"
                        >
                          <ItemMedia>
                            <Checkbox
                              name="classes"
                              value={lesson.id}
                              aria-labelledby={`instructor-class-${lesson.id}`}
                              isSelected={field.state.value.includes(lesson.id)}
                              isDisabled={disabled || !canAssign}
                              onBlur={field.handleBlur}
                              onChange={(selected) => {
                                draftChanged();
                                field.handleChange(
                                  selected
                                    ? [...field.state.value, lesson.id]
                                    : field.state.value.filter((id) => id !== lesson.id),
                                );
                                form.setFieldValue("impactAccepted", false);
                              }}
                            />
                          </ItemMedia>
                          <ItemContent>
                            <FieldLabel id={`instructor-class-${lesson.id}`}>
                              {lesson.name}
                            </FieldLabel>
                          </ItemContent>
                        </Item>
                      ))}
                  </ItemGroup>
                )}
                <FieldDescription variant="hint">
                  {t(($) => $.studio.instructorAssignmentHint)}
                </FieldDescription>
              </FieldSet>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values}>
            {(values) =>
              instructorClassesChanged(base, values) && (
                <form.Field name="impactAccepted">
                  {(field) => (
                    <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          name="impactAccepted"
                          aria-labelledby="instructor-impact-label"
                          isRequired
                          isSelected={field.state.value}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                          isDisabled={disabled}
                          isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
                          aria-describedby={
                            field.state.meta.isTouched && !field.state.meta.isValid
                              ? "instructor-impact-error"
                              : undefined
                          }
                        />
                        <FieldLabel id="instructor-impact-label">
                          {t(($) => $.studio.instructorAcceptImpact)}
                        </FieldLabel>
                      </div>
                      {field.state.meta.isTouched && !field.state.meta.isValid && (
                        <FieldError id="instructor-impact-error" errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>
          <Field orientation="horizontal">
            <div className="flex-1">
              <FieldLabel id="instructor-active-label">{t(($) => $.studio.active)}</FieldLabel>
              <FieldDescription variant="hint">
                {t(($) => $.studio.instructorRoleSeparate)}
              </FieldDescription>
            </div>
            <Switch aria-labelledby="instructor-active-label" isSelected={active} isDisabled />
          </Field>
          {completed > 0 && (
            <p role="status" className="text-sm">
              {t(($) => $.studio.instructorStepsSaved, { count: completed })}
            </p>
          )}
          {plan.length > completed && (
            <ItemGroup>
              {plan.map((step, index) => (
                <Item key={step.key} role="listitem" variant="outline" size="xs">
                  <ItemContent>
                    <ItemTitle>
                      {t(($) => $.studio.instructorStepLabels[step.kind])}
                      {step.kind === "class"
                        ? ` · ${base.classes.find((item) => item.id === step.classId)?.name ?? "—"}`
                        : ""}
                    </ItemTitle>
                    <FieldDescription variant="hint">
                      {index < completed
                        ? t(($) => $.studio.instructorStepRecorded)
                        : index === completed && notice === "unknown"
                          ? t(($) => $.studio.instructorStepUnknown)
                          : index === completed && ["conflict", "rejected"].includes(notice)
                            ? t(($) => $.studio.instructorStepFailed)
                            : t(($) => $.studio.pending)}
                    </FieldDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
          {message && (
            <Alert
              role="status"
              variant={notice === "saved" || notice === "saved-unread" ? "default" : "destructive"}
            >
              <AlertDescription className="flex flex-col items-start gap-3">
                {message}
                {notice === "unknown" ? (
                  <Button
                    data-instructor-recovery
                    isDisabled={busy}
                    variant="outline"
                    onPress={() => {
                      void write();
                    }}
                  >
                    {t(($) => $.studio.retrySameRequest)}
                  </Button>
                ) : notice === "saved-unread" ? (
                  <Button
                    data-instructor-recovery
                    isDisabled={busy}
                    variant="outline"
                    onPress={() => {
                      void retryRead();
                    }}
                  >
                    {t(($) => $.studio.retryRead)}
                  </Button>
                ) : (
                  ["conflict", "rejected"].includes(notice) && (
                    <Button
                      data-instructor-recovery
                      isDisabled={busy}
                      variant="outline"
                      onPress={() => {
                        void reload();
                      }}
                    >
                      {t(($) => $.studio.loadLatest)}
                    </Button>
                  )
                )}
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <form.Subscribe selector={(state) => state.isDirty}>
          {(dirty) =>
            target && (
              <InstructorRevoke
                scope={scope}
                target={target}
                disabled={disabled || dirty}
                onRefresh={onRoleRefresh}
                onComplete={onClose}
                onLockChange={onLockChange}
              />
            )
          }
        </form.Subscribe>
        <Button variant="outline" isDisabled={preventClose} onPress={onClose}>
          {t(($) => $.studio.cancel)}
        </Button>
        <Button
          variant="outline"
          isDisabled={disabled}
          onPress={() => {
            form.reset(instructorEditDraft(base));
            setCompleted(0);
            setNotice("ready");
          }}
        >
          {t(($) => $.studio.undo)}
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              form="studio-instructor-profile"
              isDisabled={disabled || submitting}
            >
              {t(($) => $.studio.save)}
            </Button>
          )}
        </form.Subscribe>
      </SheetFooter>
    </Sheet>
  );
}
