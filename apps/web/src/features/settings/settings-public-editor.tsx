import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Field, FieldLabel, FieldDescription, FieldError } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { SettingsReviewDialog } from "./settings-review-dialog";
import {
  parseSettingsDocumentPatch,
  settingsDocumentIntent,
  writeSettingsDocument,
  readSettingsDocumentReceipt,
  readSettingsDocumentResult,
  publicPageSlug,
  type SettingsDocumentIntent,
  type SettingsDocumentSource,
} from "./settings-document";
import { readPublicForms, readPublicConsentSources } from "./settings-public-reader";
import { readPublicContext } from "../public-program/public-calendar-read";
type PublicBinding = {
  form_id: string;
  consents: { purpose: string; version: string; required: boolean; content_template_id: string }[];
};
export function SettingsPublicEditor({
  before,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  before: SettingsDocumentSource;
  onClose: () => void;
  onSaved: (source: SettingsDocumentSource) => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const values = before.document.values;
  const [enabled, setEnabled] = useState(values.public_profile_enabled),
    [fields, setFields] = useState<
      ("name" | "description" | "logo" | "address" | "contact" | "hours" | "location" | "website")[]
    >(values.public_fields ?? []),
    [binding, setBinding] = useState<PublicBinding | null>(values.public_application_form ?? null),
    [slug, setSlug] = useState(
      before.document.scope === "organization"
        ? (before.document.values.public_page?.slug ?? "")
        : "",
    ),
    [pageEnabled, setPageEnabled] = useState(
      before.document.scope === "organization"
        ? (before.document.values.public_page?.enabled ?? false)
        : false,
    ),
    [slugError, setSlugError] = useState(false),
    [code, setCode] = useState(""),
    [lookup, setLookup] = useState(""),
    [sourceId, setSource] = useState(""),
    [purpose, setPurpose] = useState(""),
    [required, setRequired] = useState(true),
    [review, setReview] = useState<SettingsDocumentIntent>(),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(false),
    [preparing, setPreparing] = useState(false);
  const busy = useRef(false),
    mounted = useRef(true),
    slugInput = useRef<HTMLInputElement>(null);
  const publicPage =
    before.document.scope === "organization" ? before.document.values.public_page : undefined;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const forms = useInfiniteQuery({
    queryKey: ["settings-public-forms", before.scope, before.level],
    initialPageParam: undefined as string | undefined,
    queryFn: (context) => readPublicForms(before.scope, before.level, context.pageParam, context),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const sources = useQuery({
    queryKey: ["settings-public-consent-sources", before.scope, before.level, lookup],
    queryFn: (context) => readPublicConsentSources(before.scope, before.level, lookup, context),
    enabled: !!lookup,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const command = useMemberCommand({
    write: writeSettingsDocument,
    readReceipt: readSettingsDocumentReceipt,
    readResult: async (intent, id) => {
      const result = await readSettingsDocumentResult(intent, id);
      const page = intent.patch.public_page;
      if (page) {
        const read = (address: string) =>
          readPublicContext({ slug: address }, AbortSignal.timeout(15_000));
        const previous = publicPage?.slug ?? before.scope.orgId;
        const [current, former] = await Promise.all([
          read(page.slug),
          page.slug !== previous ? read(previous) : undefined,
        ]);
        if (
          (!page.enabled && current.publication_state !== "unavailable") ||
          (former && former.publication_state !== "unavailable")
        )
          throw Error("PUBLIC_PAGE_STATE_UNAVAILABLE");
      }
      return result;
    },
    onAccessLost,
    onRefresh: onSaved,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const writable = (key: string) =>
    before.catalog.fields.some((row) => row.key === key && row.writable);
  const pageWritable = before.level === "organization" && writable("public_page");
  const changePage =
    pageWritable &&
    (slug.trim() !== (publicPage?.slug ?? "") || pageEnabled !== (publicPage?.enabled ?? false));
  const currentFields: readonly (typeof fields)[number][] = values.public_fields ?? [];
  const patch = {
    ...(changePage ? { public_page: { slug: slug.trim(), enabled: pageEnabled } } : {}),
    ...(writable("public_profile_enabled") &&
    typeof enabled === "boolean" &&
    enabled !== values.public_profile_enabled
      ? { public_profile_enabled: enabled }
      : {}),
    ...(writable("public_fields") &&
    (fields.length !== currentFields.length ||
      fields.some((field) => !currentFields.includes(field)))
      ? { public_fields: fields }
      : {}),
    ...(writable("public_application_form") && binding !== (values.public_application_form ?? null)
      ? { public_application_form: binding }
      : {}),
  };
  const available = !forms.isError
    ? (forms.data?.pages.flatMap((page) => page.items).filter((row) => row.enabled) ?? [])
    : [];
  async function prepare() {
    if (busy.current || locked) return;
    if (changePage && !publicPageSlug.safeParse(slug.trim()).success) {
      setSlugError(true);
      slugInput.current?.focus();
      return;
    }
    busy.current = true;
    setPreparing(true);
    setError(false);
    try {
      const intent = await settingsDocumentIntent(
        before.scope,
        before.level,
        before,
        parseSettingsDocumentPatch(patch),
      );
      if (mounted.current) {
        command.reset();
        setReview(intent);
        setAccepted(false);
      }
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) setError(true);
    } finally {
      busy.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const title = t(($) => $.settings.publicEditor.title);
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={title}
        description={t(($) => $.settings.publicEditor.review)}
        rows={[
          ...(review.patch.public_page
            ? [
                {
                  id: "public-address",
                  title: t(($) => $.settings.publicEditor.address),
                  detail: review.patch.public_page.slug,
                },
                {
                  id: "public-state",
                  title: t(($) => $.settings.publicEditor.pageEnabled),
                  detail: t(($) =>
                    review.patch.public_page?.enabled ? $.settings.on : $.settings.off,
                  ),
                },
              ]
            : []),
          {
            id: "profile",
            title: t(($) => $.settings.publicEditor.visible),
            detail: enabled ? t(($) => $.settings.on) : t(($) => $.settings.off),
          },
          {
            id: "fields",
            title: t(($) => $.settings.publicEditor.fieldsTitle),
            detail:
              fields.map((key) => t(($) => $.settings.publicEditor.fields[key])).join(" · ") ||
              t(($) => $.settings.publicEditor.none),
          },
          {
            id: "form",
            title: t(($) => $.settings.publicEditor.form),
            detail: binding
              ? (available.find((row) => row.form_id === binding.form_id)?.form_key ??
                binding.form_id)
              : t(($) => $.settings.publicEditor.none),
          },
          ...(binding?.consents.map((row) => ({
            id: row.purpose,
            title: row.purpose,
            detail: `${row.version} · ${row.required ? t(($) => $.settings.publicEditor.required) : t(($) => $.settings.publicEditor.optional)}`,
          })) ?? []),
        ]}
        accepted={accepted}
        onAccepted={setAccepted}
        locked={locked}
        onClose={() => {
          if (!locked) {
            if (command.state === "ready") setReview(undefined);
            else onClose();
          }
        }}
        onApply={
          !command.unavailable && command.state === "ready"
            ? () => {
                if (accepted && !locked) void command.start(review);
              }
            : undefined
        }
        recoveryActions={
          <EventCommandNotice
            command={command}
            onReload={() => {
              if (!locked) {
                command.reset();
                setReview(undefined);
                setAccepted(false);
              }
            }}
          />
        }
      />
    );
  return (
    <Sheet
      isOpen
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(value) => {
        if (!value && !locked) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{t(($) => $.settings.publicEditor.hint)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 overflow-y-auto p-5">
        {pageWritable && (
          <>
            <Checkbox isSelected={pageEnabled} isDisabled={locked} onChange={setPageEnabled}>
              {t(($) => $.settings.publicEditor.pageEnabled)}
            </Checkbox>
            <Field>
              <FieldLabel htmlFor="settings-public-slug">
                {t(($) => $.settings.publicEditor.address)}
              </FieldLabel>
              <Input
                ref={slugInput}
                id="settings-public-slug"
                value={slug}
                maxLength={63}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={locked}
                aria-invalid={slugError}
                aria-describedby={
                  slugError ? "settings-public-slug-error" : "settings-public-slug-hint"
                }
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugError(false);
                }}
              />
              <FieldDescription id="settings-public-slug-hint">
                {t(($) => $.settings.publicEditor.addressHint)}
              </FieldDescription>
              {slugError && (
                <FieldError id="settings-public-slug-error">
                  {t(($) => $.settings.publicEditor.invalidAddress)}
                </FieldError>
              )}
            </Field>
          </>
        )}
        <Checkbox
          isSelected={enabled ?? false}
          isDisabled={locked || !writable("public_profile_enabled") || enabled === undefined}
          onChange={setEnabled}
        >
          {t(($) => $.settings.publicEditor.visible)}
        </Checkbox>
        <div className="space-y-2">
          <h2 className="text-sm font-medium">{t(($) => $.settings.publicEditor.fieldsTitle)}</h2>
          {(
            [
              "name",
              "description",
              "logo",
              "address",
              "contact",
              "hours",
              "location",
              "website",
            ] as const
          ).map((key) => (
            <Checkbox
              key={key}
              isSelected={fields.includes(key)}
              isDisabled={locked || !writable("public_fields")}
              onChange={(value) =>
                setFields((previous) =>
                  value ? [...previous, key] : previous.filter((item) => item !== key),
                )
              }
            >
              {t(($) => $.settings.publicEditor.fields[key])}
            </Checkbox>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="settings-public-form">
            {t(($) => $.settings.publicEditor.form)}
          </FieldLabel>
          <NativeSelect
            id="settings-public-form"
            value={binding?.form_id ?? ""}
            disabled={locked || !writable("public_application_form") || forms.isError}
            onChange={(event) => {
              if (!event.target.value) setBinding(null);
              else
                setBinding((previous) => ({
                  form_id: event.target.value,
                  consents: previous?.consents ?? [],
                }));
            }}
          >
            <NativeSelectOption value="">
              {t(($) => $.settings.publicEditor.none)}
            </NativeSelectOption>
            {binding && !available.some((row) => row.form_id === binding.form_id) && (
              <NativeSelectOption value={binding.form_id}>
                {t(($) => $.settings.publicEditor.currentForm)}
              </NativeSelectOption>
            )}
            {available.map((row) => (
              <NativeSelectOption key={row.form_id} value={row.form_id}>
                {row.form_key}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{t(($) => $.settings.publicEditor.formHint)}</FieldDescription>
          {forms.hasNextPage && (
            <Button
              variant="outline"
              isDisabled={locked || forms.isFetchingNextPage}
              onPress={() => void forms.fetchNextPage()}
            >
              {t(($) => $.settings.publicEditor.moreForms)}
            </Button>
          )}
        </Field>
        {binding && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium">{t(($) => $.settings.publicEditor.consents)}</h2>
            {binding.consents.map((row) => (
              <div key={row.purpose} className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm wrap-anywhere">
                  {row.purpose} · {row.version}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={locked || !writable("public_application_form")}
                  onPress={() =>
                    setBinding((previous) =>
                      previous
                        ? {
                            ...previous,
                            consents: previous.consents.filter(
                              (item) => item.purpose !== row.purpose,
                            ),
                          }
                        : null,
                    )
                  }
                >
                  {t(($) => $.settings.publicEditor.remove)}
                </Button>
              </div>
            ))}
            <Field>
              <FieldLabel htmlFor="public-consent-code">
                {t(($) => $.settings.publicEditor.code)}
              </FieldLabel>
              <Input
                id="public-consent-code"
                value={code}
                maxLength={128}
                disabled={locked || !writable("public_application_form")}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
            <Button
              variant="outline"
              isDisabled={locked || !code || !writable("public_application_form")}
              onPress={() => {
                setSource("");
                if (code.trim() === lookup) void sources.refetch();
                else setLookup(code.trim());
              }}
            >
              {t(($) => $.settings.publicEditor.lookup)}
            </Button>
            <Field>
              <FieldLabel htmlFor="public-consent-source">
                {t(($) => $.settings.publicEditor.approvedText)}
              </FieldLabel>
              <NativeSelect
                id="public-consent-source"
                value={sourceId}
                disabled={locked || sources.isError || !writable("public_application_form")}
                onChange={(event) => setSource(event.target.value)}
              >
                <NativeSelectOption value="">
                  {t(($) => $.settings.publicEditor.chooseText)}
                </NativeSelectOption>
                {(!sources.isError ? (sources.data ?? []) : []).map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.code} · {row.language} · {row.source_version} · {row.version}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="public-consent-purpose">
                {t(($) => $.settings.publicEditor.purpose)}
              </FieldLabel>
              <Input
                id="public-consent-purpose"
                value={purpose}
                maxLength={100}
                disabled={locked || !writable("public_application_form")}
                onChange={(event) => setPurpose(event.target.value)}
              />
            </Field>
            <Checkbox
              isSelected={required}
              isDisabled={locked || !writable("public_application_form")}
              onChange={setRequired}
            >
              {t(($) => $.settings.publicEditor.required)}
            </Checkbox>
            <Button
              variant="outline"
              isDisabled={
                locked || !sourceId || !purpose.trim() || !writable("public_application_form")
              }
              onPress={() => {
                const source = !sources.isError
                  ? sources.data?.find((row) => row.id === sourceId)
                  : undefined;
                if (source && binding)
                  setBinding({
                    ...binding,
                    consents: [
                      ...binding.consents.filter((row) => row.purpose !== purpose.trim()),
                      {
                        purpose: purpose.trim(),
                        version: source.source_version,
                        content_template_id: source.id,
                        required,
                      },
                    ],
                  });
              }}
            >
              {t(($) => $.settings.publicEditor.add)}
            </Button>
          </div>
        )}
        <Alert>
          <AlertDescription>{t(($) => $.settings.publicEditor.nativeBoundary)}</AlertDescription>
        </Alert>
        {(error || forms.isError || sources.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.settings.publicEditor.error)}
              <Button
                variant="outline"
                isDisabled={locked}
                onPress={() => {
                  void forms.refetch();
                  if (lookup) void sources.refetch();
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
      <SheetFooter>
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button
          isDisabled={
            locked ||
            command.unavailable ||
            binding?.consents.length === 0 ||
            !Object.keys(patch).length
          }
          onPress={() => void prepare()}
        >
          {t(($) => $.settings.policyEditor.review)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
