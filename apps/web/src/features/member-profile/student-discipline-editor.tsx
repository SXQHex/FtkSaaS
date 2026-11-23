import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { DisciplineView, PersonView } from "@ftksaas/api-contracts";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldSet,
  FieldLegend,
} from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { RadioGroup, RadioGroupItem } from "@ftksaas/ui/components/radio-group";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { useMemberCommand } from "./use-member-command";
import {
  prepareStudentDiscipline,
  writeStudentDiscipline,
  studentDisciplineReceipt,
  readStudentDisciplineResult,
  type StudentDisciplineIntent,
  type StudentDisciplineState,
} from "./student-discipline";

export function StudentDisciplineEditor({
  scope,
  person,
  disciplines,
  sourceAvailable,
  onClose,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  person: PersonView;
  disciplines: DisciplineView[];
  sourceAvailable: boolean;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: (person: PersonView, assertCurrent: () => void) => Promise<void>;
}) {
  const { t } = useTranslation(),
    id = useId(),
    selector = useRef<HTMLSelectElement>(null);
  const active = person.relationships.some(
    (row) => row.center_id === scope.centerId && row.kind === "student" && row.state === "active",
  );
  const [disciplineId, setDiscipline] = useState(""),
    [state, setState] = useState<StudentDisciplineState>(active ? "active" : "inactive"),
    [invalid, setInvalid] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<"source" | "same">(),
    [review, setReview] = useState<StudentDisciplineIntent>(),
    [accepted, setAccepted] = useState(false);
  const command = useMemberCommand({
    write: writeStudentDiscipline,
    readReceipt: studentDisciplineReceipt,
    readResult: readStudentDisciplineResult,
    onRefresh,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function resetReview() {
    if (locked) return;
    setReview(undefined);
    setAccepted(false);
    command.reset();
  }
  async function prepare() {
    if (locked || !sourceAvailable || review) return;
    if (!disciplines.some((row) => row.id === disciplineId)) {
      setInvalid(true);
      selector.current?.focus();
      return;
    }
    setPreparing(true);
    setError(undefined);
    try {
      setReview(await prepareStudentDiscipline(scope, person.id, disciplineId, state));
      setAccepted(false);
    } catch (failure) {
      if (!onAccessLost(failure))
        setError(
          failure instanceof Error && failure.message === "STUDENT_DISCIPLINE_NO_CHANGE"
            ? "same"
            : "source",
        );
    } finally {
      setPreparing(false);
    }
  }
  const commandState = command.state;
  const notice =
    commandState === "ready" ? undefined : t(($) => $.studentDiscipline.states[commandState]);
  const stateLabel = (value: StudentDisciplineState) =>
    value === "active" ? t(($) => $.people.states.active) : t(($) => $.people.states.inactive);
  const recovery = (
    <>
      {["unknown", "pending"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.retry();
          }}
        >
          {t(($) => $.finance.retrySame)}
        </Button>
      )}
      {["unknown", "pending", "saved-unread"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.readReceipt();
          }}
        >
          {t(($) => $.finance.readResult)}
        </Button>
      )}
    </>
  );
  return (
    <>
      <Sheet
        isOpen
        onOpenChange={(open) => {
          if (!open && !locked) onClose();
        }}
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle id={id + "-title"}>{t(($) => $.studentDiscipline.title)}</SheetTitle>
          <SheetDescription>{person.display_name}</SheetDescription>
        </SheetHeader>
        <form
          id={id}
          method="post"
          noValidate
          aria-labelledby={id + "-title"}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <FieldGroup>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor={id + "-discipline"}>
                {t(($) => $.studentDiscipline.discipline)}
              </FieldLabel>
              <NativeSelect
                id={id + "-discipline"}
                ref={selector}
                name="discipline"
                autoFocus
                required
                value={disciplineId}
                disabled={locked || !!review || !sourceAvailable}
                aria-invalid={invalid}
                aria-describedby={invalid ? id + "-error" : undefined}
                onChange={(event) => {
                  setDiscipline(event.target.value);
                  setInvalid(false);
                  setError(undefined);
                }}
              >
                <NativeSelectOption value="">
                  {t(($) => $.studentDiscipline.choose)}
                </NativeSelectOption>
                {disciplines.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {invalid && (
                <FieldError id={id + "-error"}>{t(($) => $.studentDiscipline.required)}</FieldError>
              )}
            </Field>
            <FieldSet>
              <FieldLegend>{t(($) => $.studentDiscipline.state)}</FieldLegend>
              <RadioGroup
                aria-label={t(($) => $.studentDiscipline.state)}
                value={state}
                isDisabled={locked || !!review || !sourceAvailable}
                onChange={(value) => {
                  if (value === "active" || value === "inactive") {
                    setState(value);
                    setError(undefined);
                  }
                }}
              >
                <Field orientation="horizontal">
                  <RadioGroupItem
                    id={id + "-active"}
                    aria-labelledby={id + "-active-label"}
                    value="active"
                    isDisabled={!active}
                  />
                  <FieldLabel id={id + "-active-label"} htmlFor={id + "-active"}>
                    {stateLabel("active")}
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem
                    id={id + "-inactive"}
                    aria-labelledby={id + "-inactive-label"}
                    value="inactive"
                  />
                  <FieldLabel id={id + "-inactive-label"} htmlFor={id + "-inactive"}>
                    {stateLabel("inactive")}
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
          {error && (
            <Alert role="alert" variant={error === "same" ? "default" : "destructive"}>
              <AlertDescription>
                {error === "same"
                  ? t(($) => $.studentDiscipline.same)
                  : t(($) => $.studentDiscipline.sourceError)}
              </AlertDescription>
            </Alert>
          )}
        </form>
        <SheetFooter>
          <Button variant="outline" isDisabled={locked} onPress={onClose}>
            {t(($) => $.memberProfile.close)}
          </Button>
          <Button type="submit" form={id} isDisabled={locked || !sourceAvailable || !!review}>
            {t(($) => $.studentDiscipline.review)}
          </Button>
        </SheetFooter>
      </Sheet>
      {review && (
        <SettingsReviewDialog
          open
          title={t(($) => $.studentDiscipline.review)}
          description={review.name}
          rows={[
            {
              id: "discipline",
              title: t(($) => $.studentDiscipline.discipline),
              detail: review.disciplineName,
            },
            {
              id: "before",
              title: t(($) => $.studentDiscipline.before),
              detail: review.beforeState
                ? stateLabel(review.beforeState)
                : t(($) => $.studentDiscipline.unbound),
            },
            {
              id: "after",
              title: t(($) => $.studentDiscipline.state),
              detail: stateLabel(review.state),
            },
          ]}
          accepted={accepted}
          locked={locked}
          onAccepted={command.state === "ready" ? setAccepted : undefined}
          onClose={command.state === "saved" ? onClose : resetReview}
          onApply={
            accepted && command.state === "ready"
              ? () => {
                  void command.start(review);
                }
              : undefined
          }
          notice={notice}
          recoveryActions={recovery}
          applyLabel={t(($) => $.studentDiscipline.apply)}
        />
      )}
    </>
  );
}
