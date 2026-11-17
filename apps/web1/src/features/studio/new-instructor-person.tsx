import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { XIcon } from "lucide-react";
import { BackendError } from "../../lib/backend";
import type { PersonSummary } from "../../lib/api-contracts/generated";
import type { StudioScope } from "./studio";
import {
  createInstructorPerson,
  findInstructorPeople,
  newInstructorIntent,
  newInstructorSchema,
  type NewInstructorIntent,
} from "./instructor-enrollment";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "../../components/ui/sheet";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect } from "../../components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function NewInstructorPerson({
  scope,
  onSelected,
  onClose,
  onLockChange,
}: {
  scope: StudioScope;
  onSelected: (personId: string) => void;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("new");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [resultQuery, setResultQuery] = useState("");
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState("");
  const intent = useRef<NewInstructorIntent | undefined>(undefined);
  const created = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const mounted = useRef(true);
  const formElement = useRef<HTMLFormElement>(null);
  const preventClose = creating || unknown;
  useLayoutEffect(() => {
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
    shouldBlockFn: () => lock.current || Boolean(intent.current),
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });
  const form = useForm({
    formId: "new-instructor-person",
    defaultValues: { name: "", email: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    validators: {
      onDynamic: newInstructorSchema({
        name: t(($) => $.studio.nameRequired),
        email: t(($) => $.studio.instructorEmailInvalid),
      }),
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() =>
        formElement.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    },
    onSubmit: async ({ value }) => {
      if (!preventClose) await create(newInstructorIntent(scope, value));
    },
  });
  function close() {
    if (preventClose || intent.current) return;
    mounted.current = false;
    onClose();
  }
  async function create(next?: NewInstructorIntent) {
    if (lock.current || created.current) return;
    const current = next ?? intent.current;
    if (!current) return;
    intent.current = current;
    setCreating(true);
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const id = await createInstructorPerson(current);
      created.current = id;
      intent.current = undefined;
      if (mounted.current) onSelected(id);
    } catch (error) {
      if (!mounted.current) return;
      if (
        (error instanceof BackendError && error.code !== "TRANSPORT_ERROR" && !error.retryable) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        intent.current = undefined;
        setUnknown(false);
        setFailed(true);
      } else setUnknown(true);
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setCreating(false);
      }
    }
  }
  async function lookup(more = false) {
    if (lock.current || unknown || (more && !cursor)) return;
    const query = more ? resultQuery : search.trim();
    lock.current = true;
    setBusy(true);
    setFailed(false);
    if (!more) {
      setPeople([]);
      setSelected("");
      setCursor(null);
    }
    try {
      const page = await findInstructorPeople(
        scope,
        query,
        more ? (cursor ?? undefined) : undefined,
      );
      if (!mounted.current) return;
      setPeople((current) => (more ? [...current, ...page.items] : page.items));
      setResultQuery(query);
      setCursor(page.next_cursor ?? null);
      setSearched(true);
    } catch {
      if (mounted.current) {
        setPeople([]);
        setSelected("");
        setCursor(null);
        setFailed(true);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
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
        <SheetTitle>{t(($) => $.studio.addInstructor)}</SheetTitle>
        <SheetDescription>{t(($) => $.studio.newInstructorDescription)}</SheetDescription>
        <SheetClose
          className="absolute top-4 right-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.studio.close)}
          isDisabled={preventClose}
        >
          <XIcon />
        </SheetClose>
        <ToggleGroup
          className="max-w-full flex-wrap"
          variant="segmented"
          size="segmented"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([mode])}
          aria-label={t(($) => $.studio.personChoice)}
          onSelectionChange={(keys) => {
            if (!busy && !unknown) {
              setMode(String([...keys][0]));
              setFailed(false);
            }
          }}
        >
          <ToggleGroupItem id="new" isDisabled={busy || unknown}>
            {t(($) => $.studio.newPerson)}
          </ToggleGroupItem>
          <ToggleGroupItem id="existing" isDisabled={busy || unknown}>
            {t(($) => $.studio.existingPerson)}
          </ToggleGroupItem>
        </ToggleGroup>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {mode === "new" ? (
          <form
            id="new-instructor-person"
            ref={formElement}
            aria-label={t(($) => $.studio.newPerson)}
            aria-busy={busy}
            noValidate
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
                    <FieldLabel htmlFor="new-instructor-name">
                      {t(($) => $.studio.fullName)} <span aria-hidden="true">*</span>
                    </FieldLabel>
                    <Input
                      id="new-instructor-name"
                      name="name"
                      autoComplete="name"
                      required
                      disabled={preventClose}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.isTouched && !field.state.meta.isValid
                          ? "new-instructor-name-error"
                          : undefined
                      }
                    />
                    {field.state.meta.isTouched && !field.state.meta.isValid && (
                      <FieldError id="new-instructor-name-error" errors={field.state.meta.errors} />
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
                    <FieldLabel htmlFor="new-instructor-email">
                      {t(($) => $.studio.email)} <span aria-hidden="true">*</span>
                    </FieldLabel>
                    <Input
                      id="new-instructor-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      disabled={preventClose}
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.isTouched && !field.state.meta.isValid
                          ? "new-instructor-email-error"
                          : undefined
                      }
                    />
                    {field.state.meta.isTouched && !field.state.meta.isValid && (
                      <FieldError
                        id="new-instructor-email-error"
                        errors={field.state.meta.errors}
                      />
                    )}
                  </Field>
                )}
              </form.Field>
              <FieldDescription variant="hint">{t(($) => $.studio.newPersonHint)}</FieldDescription>
            </FieldGroup>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <search>
              <form
                aria-label={t(($) => $.studio.findPerson)}
                onSubmit={(event) => {
                  event.preventDefault();
                  void lookup();
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <Field className="min-w-0 flex-1">
                  <FieldLabel htmlFor="instructor-person-search">
                    {t(($) => $.studio.searchPersonName)}
                  </FieldLabel>
                  <Input
                    id="instructor-person-search"
                    name="query"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    disabled={busy}
                    autoComplete="off"
                  />
                </Field>
                <Button
                  className="h-auto min-h-8 max-w-full whitespace-normal"
                  type="submit"
                  variant="outline"
                  isDisabled={busy}
                >
                  {t(($) => $.studio.findPerson)}
                </Button>
              </form>
            </search>
            {searched && !failed && (
              <Field className="gap-1.5">
                <FieldLabel htmlFor="existing-instructor-person">
                  {t(($) => $.studio.existingPerson)}
                </FieldLabel>
                <NativeSelect
                  id="existing-instructor-person"
                  className="w-full"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  disabled={busy || !people.length}
                >
                  <option value="">{t(($) => $.studio.choosePerson)}</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.display_name}
                    </option>
                  ))}
                </NativeSelect>
                {!people.length && (
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.noPeopleFound)}
                  </FieldDescription>
                )}
              </Field>
            )}
            {cursor && (
              <Button
                className="h-auto min-h-8 max-w-full whitespace-normal"
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  void lookup(true);
                }}
              >
                {t(($) => $.studio.morePeople)}
              </Button>
            )}
          </div>
        )}
        {(failed || unknown) && (
          <Alert role="status" variant="destructive" className="mt-4">
            <AlertDescription className="flex flex-col items-start gap-3">
              {unknown
                ? t(($) => $.studio.resourceUnknown)
                : mode === "new"
                  ? t(($) => $.studio.personCreateFailed)
                  : t(($) => $.studio.resourceReadError)}
              {unknown && (
                <Button
                  className="h-auto min-h-8 max-w-full whitespace-normal"
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => {
                    void create();
                  }}
                >
                  {t(($) => $.studio.retrySameRequest)}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        <Button
          className="h-auto min-h-8 max-w-full whitespace-normal"
          variant="outline"
          isDisabled={preventClose}
          onPress={close}
        >
          {t(($) => $.studio.cancel)}
        </Button>
        {mode === "new" ? (
          <Button
            className="h-auto min-h-8 max-w-full whitespace-normal"
            type="submit"
            form="new-instructor-person"
            isDisabled={preventClose}
          >
            {t(($) => $.studio.createPersonContinue)}
          </Button>
        ) : (
          <Button
            className="h-auto min-h-8 max-w-full whitespace-normal"
            isDisabled={busy || !people.some((person) => person.id === selected)}
            onPress={() => {
              if (!busy && people.some((person) => person.id === selected)) onSelected(selected);
            }}
          >
            {t(($) => $.studio.continueEnrollment)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
