import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Field, FieldLabel, FieldDescription, FieldGroup } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { readPerson } from "../people/people";
import { writablePersonField } from "../studio/instructor-identity";
import { useMemberCommand } from "./use-member-command";
import {
  personEditDraft,
  personEditPatch,
  preparePersonEdit,
  writePersonEdit,
  personEditReceipt,
  readPersonEditResult,
  type PersonEditIntent,
} from "./person-edit";

interface Props {
  scope: ClientScope;
  personId: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: (person: PersonView) => Promise<void>;
}
export function PersonEditor(props: Props) {
  const { t } = useTranslation();
  const { onAccessLost } = props;
  const query = useQuery({
    queryKey: [
      "person-editor",
      props.scope.accountId,
      props.scope.orgId,
      props.scope.centerId,
      props.personId,
    ],
    queryFn: (readContext) => readPerson(props.scope, props.personId, undefined, readContext),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  if (query.data && !query.isError && !query.isFetching)
    return <PersonEditForm {...props} person={query.data} />;
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.personEdit.title)}</SheetTitle>
        <SheetDescription>{t(($) => $.personEdit.description)}</SheetDescription>
      </SheetHeader>
      <div className="px-6 py-4" role={query.isError ? "alert" : "status"}>
        {query.isError ? t(($) => $.personEdit.sourceError) : t(($) => $.people.loading)}
      </div>
      <SheetFooter>
        <Button variant="outline" onPress={props.onClose}>
          {t(($) => $.memberProfile.close)}
        </Button>
        {query.isError && (
          <Button
            onPress={() => {
              void query.refetch();
            }}
          >
            {t(($) => $.people.retry)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
function PersonEditForm({ person, ...props }: Props & { person: PersonView }) {
  const { t } = useTranslation(),
    id = useId(),
    form = useRef<HTMLFormElement>(null),
    errorFocus = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => personEditDraft(person)),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<"invalid" | "sourceError" | "same">(),
    [review, setReview] = useState<PersonEditIntent>(),
    [accepted, setAccepted] = useState(false);
  const command = useMemberCommand({
    write: writePersonEdit,
    readReceipt: personEditReceipt,
    readResult: readPersonEditResult,
    onRefresh: props.onRefresh,
    onAccessLost: props.onAccessLost,
  });
  const { onLockChange } = props;
  const commandState = command.state;
  const locked = preparing || command.locked,
    disabled = locked || !!review || !props.sourceAvailable;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (error) errorFocus.current?.focus();
  }, [error]);
  async function prepare() {
    if (disabled) return;
    if (!form.current?.reportValidity()) return;
    try {
      personEditPatch(person, draft);
    } catch {
      setError("invalid");
      return;
    }
    setPreparing(true);
    setError(undefined);
    try {
      setReview(await preparePersonEdit(props.scope, person, draft));
      setAccepted(false);
    } catch (failure) {
      if (!props.onAccessLost(failure))
        setError(
          failure instanceof Error && failure.message === "PERSON_EDIT_NO_CHANGE"
            ? "same"
            : "sourceError",
        );
    } finally {
      setPreparing(false);
    }
  }
  const label = (kind: "email" | "phone") =>
    kind === "email" ? t(($) => $.people.email) : t(($) => $.personEdit.phone);
  const info = (name: string, contacts: { kind: "email" | "phone"; value: string }[]) =>
    [name, ...contacts.map((row) => `${label(row.kind)}: ${row.value}`)].join(" · ");
  return (
    <>
      <Sheet
        isOpen
        onOpenChange={(open) => {
          if (!open && !locked) props.onClose();
        }}
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle id={id + "-title"}>{t(($) => $.personEdit.title)}</SheetTitle>
          <SheetDescription>{t(($) => $.personEdit.description)}</SheetDescription>
        </SheetHeader>
        <form
          ref={form}
          id={id}
          method="post"
          aria-labelledby={id + "-title"}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <FieldDescription id={id + "-policy"}>{t(($) => $.personEdit.readonly)}</FieldDescription>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={id + "-name"}>{t(($) => $.people.fullName)}</FieldLabel>
              <Input
                id={id + "-name"}
                name="display_name"
                autoComplete="off"
                required
                autoFocus
                value={draft.name}
                disabled={disabled}
                readOnly={!writablePersonField(person.field_policy?.display_name)}
                aria-describedby={id + "-policy"}
                onChange={(event) => {
                  setDraft({ ...draft, name: event.target.value });
                  setError(undefined);
                }}
              />
            </Field>
            {draft.contacts.map((contact, index) => (
              <Field key={index}>
                <FieldLabel htmlFor={`${id}-contact-${index}`}>
                  {label(contact.kind)} {index + 1}
                </FieldLabel>
                <Input
                  id={`${id}-contact-${index}`}
                  name={`contact-${index}`}
                  type={contact.kind === "email" ? "email" : "tel"}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={contact.value}
                  disabled={disabled}
                  readOnly={
                    index < (person.contacts?.length ?? 0) &&
                    !writablePersonField(person.contacts?.[index]?.field_policy)
                  }
                  aria-describedby={id + "-policy"}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      contacts: draft.contacts.map((row, i) =>
                        i === index ? { ...row, value: event.target.value } : row,
                      ),
                    });
                    setError(undefined);
                  }}
                />
              </Field>
            ))}
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            {(["email", "phone"] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                isDisabled={disabled || !person.contacts}
                onPress={() => {
                  setDraft({ ...draft, contacts: [...draft.contacts, { kind, value: "" }] });
                  setError(undefined);
                }}
              >
                {kind === "email"
                  ? t(($) => $.personEdit.addEmail)
                  : t(($) => $.personEdit.addPhone)}
              </Button>
            ))}
          </div>
          {error && (
            <div ref={errorFocus} tabIndex={-1}>
              <Alert role="alert" variant={error === "same" ? "default" : "destructive"}>
                <AlertDescription>{t(($) => $.personEdit[error])}</AlertDescription>
              </Alert>
            </div>
          )}
        </form>
        <SheetFooter>
          <Button type="button" variant="outline" isDisabled={locked} onPress={props.onClose}>
            {t(($) => $.memberProfile.close)}
          </Button>
          <Button type="submit" form={id} isDisabled={disabled}>
            {t(($) => $.personEdit.review)}
          </Button>
        </SheetFooter>
      </Sheet>
      {review && (
        <SettingsReviewDialog
          open
          title={t(($) => $.personEdit.review)}
          description={t(($) => $.personEdit.description)}
          rows={[
            {
              id: "before",
              title: t(($) => $.personEdit.before),
              detail: info(review.before.name, review.before.contacts),
            },
            {
              id: "after",
              title: t(($) => $.personEdit.after),
              detail: info(
                review.patch.display_name ?? review.before.name,
                review.patch.contacts ?? review.before.contacts,
              ),
            },
          ]}
          accepted={accepted}
          locked={locked}
          onAccepted={command.state === "ready" ? setAccepted : undefined}
          onClose={
            command.state === "saved"
              ? props.onClose
              : () => {
                  if (!locked) {
                    setReview(undefined);
                    setAccepted(false);
                    command.reset();
                  }
                }
          }
          onApply={
            accepted && command.state === "ready"
              ? () => {
                  void command.start(review);
                }
              : undefined
          }
          applyLabel={t(($) => $.personEdit.apply)}
          notice={
            commandState === "ready" ? undefined : t(($) => $.personEdit.states[commandState])
          }
          recoveryActions={
            <>
              {["unknown", "pending"].includes(command.state) && (
                <Button
                  isDisabled={command.busy}
                  variant="outline"
                  onPress={() => {
                    void command.retry();
                  }}
                >
                  {t(($) => $.finance.retrySame)}
                </Button>
              )}
              {["unknown", "pending", "saved-unread"].includes(command.state) && (
                <Button
                  isDisabled={command.busy}
                  variant="outline"
                  onPress={() => {
                    void command.readReceipt();
                  }}
                >
                  {t(($) => $.finance.readResult)}
                </Button>
              )}
            </>
          }
        />
      )}
    </>
  );
}
