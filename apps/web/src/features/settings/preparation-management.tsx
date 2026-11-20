import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { EventPreparationFields } from "./event-preparation-fields";
import { eventCapacityInput, eventTermsDraft, eventTermsInput } from "../events/event-command";
import { emptyEventDraft } from "../events/event-draft";
import type {
  ProCollectionPreparation,
  ProCrmPreparation,
  ProProgramPreparation,
  ProEventPreparation,
  ProAutomationPreparation,
} from "@ftksaas/api-contracts";
import {
  parseSettingsDocumentPatch,
  type SettingsDocumentPatch,
  type SettingsDocumentSource,
  type PreparationFamily,
  type InheritedPreparationFamily,
} from "./settings-document";

type Template =
  | ProCollectionPreparation
  | ProCrmPreparation
  | ProProgramPreparation
  | ProEventPreparation
  | ProAutomationPreparation;
const automationTriggers = [
  "entitlement_expiring",
  "student_inactive",
  "lead_followup_due",
] as const;
const emptyAutomation = { trigger: "", days: "", action: "", template: "" };
const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const emptyProgram = {
  weekdays: [] as string[],
  start: "",
  duration: "",
  total: "",
  male: "",
  female: "",
};
type Review = (
  patch: Pick<SettingsDocumentPatch, PreparationFamily>,
  rows: { id: string; title: string; detail: string }[],
  inherit?: InheritedPreparationFamily,
) => void;

export function PreparationManagement({
  source,
  family,
  locked,
  readOnly,
  onReview,
}: {
  source: SettingsDocumentSource;
  family: PreparationFamily;
  locked: boolean;
  readOnly: boolean;
  onReview: Review;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [program, setProgram] = useState(emptyProgram);
  const [eventDraft, setEventDraft] = useState(emptyEventDraft);
  const [automationDraft, setAutomationDraft] = useState(emptyAutomation);
  const [error, setError] = useState(false);
  const descriptor = source.catalog.fields.find(({ key }) => key === family);
  const rows = source.document.values[family];
  if (!descriptor || !rows) return null;
  const inherited =
    family !== "program_templates" &&
    source.document.scope === "center" &&
    !!source.document.inherited_fields?.[family];
  const disabled = locked || readOnly || !descriptor.writable;
  const collection = family === "collection_templates";
  const weekly = family === "program_templates";
  const event = family === "event_templates";
  const automation = family === "automation_templates";
  const actionLabel = (value: string) =>
    value === "create_followup"
      ? t(($) => $.automation.followup)
      : t(($) => $.settings.preparation.reminderAction);
  const title = t(($) => $.settings.preparation[family]);
  const method = (value: string) =>
    value === "cash"
      ? t(($) => $.finance.cash)
      : value === "bank_transfer"
        ? t(($) => $.finance.bank)
        : t(($) => $.finance.card);

  function select(row?: Template) {
    setSelected(row?.key ?? "");
    setName(row?.name ?? "");
    const terms = row?.defaults;
    setFirst(
      terms && "currency" in terms
        ? terms.currency
        : terms && "source" in terms
          ? terms.source
          : "",
    );
    setSecond(
      terms && "payment_method" in terms
        ? terms.payment_method
        : terms && "interest" in terms
          ? terms.interest
          : "",
    );
    setProgram(
      terms && "weekdays" in terms
        ? {
            weekdays: terms.weekdays.map(String),
            start: terms.local_start,
            duration: String(terms.duration_minutes),
            total: String(terms.capacity.total),
            male: terms.capacity.categories ? String(terms.capacity.categories.male) : "",
            female: terms.capacity.categories ? String(terms.capacity.categories.female) : "",
          }
        : emptyProgram,
    );
    setEventDraft(
      terms && "terms" in terms
        ? { ...emptyEventDraft, ...eventTermsDraft(terms.capacity, terms.terms) }
        : emptyEventDraft,
    );
    setAutomationDraft(
      terms && "trigger" in terms
        ? {
            trigger: terms.trigger.kind,
            days: String(terms.trigger.offset_days),
            action: terms.action.kind,
            template: terms.action.template_key,
          }
        : emptyAutomation,
    );
    setError(false);
  }
  function describe(row?: Template) {
    if (!row) return t(($) => $.settings.unsetHint);
    const terms = row.defaults;
    if ("weekdays" in terms) {
      const days = terms.weekdays
        .map((day) => t(($) => $.schedule.weekdays[weekdays[day - 1]!]))
        .join(", ");
      const counts = terms.capacity.categories
        ? ` · ${t(($) => $.schedule.capacityCategories.male)} ${terms.capacity.categories.male} · ${t(($) => $.schedule.capacityCategories.female)} ${terms.capacity.categories.female}`
        : "";
      return `${row.name} · ${days} · ${terms.local_start} · ${terms.duration_minutes} dk · ${t(($) => $.schedule.capacity)} ${terms.capacity.total}${counts}`;
    }
    if ("terms" in terms) {
      const value = terms.terms;
      const capacity =
        "kind" in terms.capacity
          ? t(($) => $.events.editor.unlimited)
          : `${t(($) => $.events.editor.nominal)} ${terms.capacity.nominal} · ${t(($) => $.events.editor.maximum)} ${terms.capacity.maximum}`;
      const kind =
        value.package_usage === "eligibility_only"
          ? t(($) => $.events.editor.practice)
          : t(($) => $.events.editor.workshop);
      const payment = value.full_payment_required
        ? ` · ${t(($) => $.events.editor.fullPayment)}`
        : "";
      const packages = value.allowed_product_version_ids.length
        ? ` · ${t(($) => $.events.editor.products)} ${value.allowed_product_version_ids.join(", ")}`
        : "";
      const cancellation = value.cancellation;
      const effects = [cancellation.before_cutoff, cancellation.after_cutoff, cancellation.no_show]
        .map((effect) => t(($) => $.settings.nativePolicies[effect]))
        .join(" / ");
      return `${row.name} · ${kind} · ${capacity} · ${t(($) => $.events.editor.fee)} ${value.fee_minor} ${value.currency}${payment}${packages} · ${t(($) => $.events.editor.cancellation)} ${cancellation.cutoff_minutes ?? ""} ${effects} · ${t(($) => $.events.refunds[value.refund.method])}${value.refund.used_unit_minor ? ` (${value.refund.used_unit_minor} ${value.currency})` : ""}`;
    }
    if ("trigger" in terms)
      return `${row.name} · ${t(($) => $.automation.triggers[terms.trigger.kind])} · ${t(($) => $.automation.offsetDays)} ${terms.trigger.offset_days} · ${actionLabel(terms.action.kind)} · ${terms.action.template_key}`;
    return `${row.name} · ${"currency" in terms ? `${terms.currency} · ${method(terms.payment_method)}` : `${terms.source} · ${terms.interest}`}`;
  }
  function review(remove = false) {
    if (disabled || !rows) return;
    const original = rows.find((row) => row.key === selected);
    const key = original?.key ?? `template-${crypto.randomUUID()}`;
    const number = (value: string) => (value === "" ? NaN : Number(value));
    const originalProgram =
      original?.defaults && "weekdays" in original.defaults ? original.defaults : undefined;
    const programDefaults = {
      weekdays: program.weekdays.map(Number).sort((a, b) => a - b),
      local_start: program.start.length === 5 ? `${program.start}:00` : program.start,
      duration_minutes: number(program.duration),
      capacity: {
        total: number(program.total),
        ...(program.male !== "" || program.female !== ""
          ? { categories: { male: number(program.male), female: number(program.female) } }
          : originalProgram?.capacity.categories !== undefined
            ? { categories: null }
            : {}),
      },
    };
    if (remove && !original) return;
    try {
      const existingEvent =
        original?.defaults && "terms" in original.defaults ? original.defaults : undefined;
      const next = remove
        ? undefined
        : {
            key,
            name: name.trim(),
            defaults: automation
              ? {
                  trigger: {
                    kind: automationDraft.trigger,
                    offset_days: number(automationDraft.days),
                  },
                  action: {
                    kind: automationDraft.action,
                    channel: "in_app",
                    template_key: automationDraft.template.trim(),
                  },
                }
              : event
                ? {
                    capacity: eventCapacityInput(eventDraft),
                    terms: eventTermsInput(eventDraft, existingEvent?.terms.package_usage),
                  }
                : weekly
                  ? programDefaults
                  : collection
                    ? { currency: first.trim(), payment_method: second }
                    : { source: first.trim(), interest: second.trim() },
          };
      if (next && original && JSON.stringify(original) === JSON.stringify(next)) return;
      const retained = rows.filter((row) => row.key !== key);
      const patch = parseSettingsDocumentPatch({
        [family]: !next
          ? retained
          : original
            ? rows.map((row) => (row.key === key ? next : row))
            : [...retained, next],
      });
      const formatted = patch[family]?.find((row) => row.key === key);
      onReview(patch, [
        { id: key, title, detail: `${describe(original)} → ${describe(formatted)}` },
        ...(inherited
          ? [
              {
                id: "scope",
                title: t(($) => $.settings.nativePolicies.center),
                detail: t(($) => $.settings.preparation.inheritanceHint),
              },
            ]
          : []),
      ]);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 id={`${id}-title`}>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          aria-labelledby={`${id}-title`}
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-selected`}>
                {t(($) => $.settings.preparation.title)}
              </FieldLabel>
              <NativeSelect
                id={`${id}-selected`}
                value={selected}
                disabled={locked}
                onChange={(event) => select(rows.find((row) => row.key === event.target.value))}
              >
                <NativeSelectOption value="">
                  {t(($) => $.settings.preparation.new)}
                </NativeSelectOption>
                {rows.map((row) => (
                  <NativeSelectOption key={row.key} value={row.key}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {inherited && (
                <FieldDescription>
                  {t(($) => $.settings.preparation.inheritanceHint)}
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>
                {t(($) => $.settings.preparation.name)}
              </FieldLabel>
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={100}
                disabled={disabled}
              />
            </Field>
            {automation ? (
              <>
                <Field>
                  <FieldLabel htmlFor={`${id}-trigger`}>
                    {t(($) => $.automation.columns.when)}
                  </FieldLabel>
                  <NativeSelect
                    id={`${id}-trigger`}
                    required
                    value={automationDraft.trigger}
                    disabled={disabled}
                    onChange={(event) =>
                      setAutomationDraft({ ...automationDraft, trigger: event.target.value })
                    }
                  >
                    <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                    {automationTriggers.map((kind) => (
                      <NativeSelectOption key={kind} value={kind}>
                        {t(($) => $.automation.triggers[kind])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-days`}>
                    {t(($) => $.automation.offsetDays)}
                  </FieldLabel>
                  <Input
                    id={`${id}-days`}
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={automationDraft.days}
                    disabled={disabled}
                    onChange={(event) =>
                      setAutomationDraft({ ...automationDraft, days: event.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-action`}>
                    {t(($) => $.automation.columns.action)}
                  </FieldLabel>
                  <NativeSelect
                    id={`${id}-action`}
                    required
                    value={automationDraft.action}
                    disabled={disabled}
                    onChange={(event) =>
                      setAutomationDraft({
                        ...automationDraft,
                        action: event.target.value,
                        template: "",
                      })
                    }
                  >
                    <NativeSelectOption value="">{t(($) => $.schedule.choose)}</NativeSelectOption>
                    {(["create_followup", "send_reminder"] as const).map((kind) => (
                      <NativeSelectOption key={kind} value={kind}>
                        {actionLabel(kind)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                {automationDraft.action && (
                  <Field>
                    <FieldLabel htmlFor={`${id}-template`}>
                      {t(($) =>
                        automationDraft.action === "create_followup"
                          ? $.settings.preparation.followupText
                          : $.settings.preparation.reminderKey,
                      )}
                    </FieldLabel>
                    <Input
                      id={`${id}-template`}
                      required
                      value={automationDraft.template}
                      disabled={disabled}
                      onChange={(event) =>
                        setAutomationDraft({ ...automationDraft, template: event.target.value })
                      }
                    />
                  </Field>
                )}
              </>
            ) : event ? (
              <EventPreparationFields
                scope={source.scope}
                draft={eventDraft}
                onDraft={setEventDraft}
                disabled={disabled}
              />
            ) : weekly ? (
              <>
                <Field>
                  <FieldLabel id={`${id}-days`}>{t(($) => $.schedule.whichDays)}</FieldLabel>
                  <ToggleGroup
                    aria-labelledby={`${id}-days`}
                    selectionMode="multiple"
                    selectedKeys={program.weekdays}
                    isDisabled={disabled}
                    onSelectionChange={(keys) =>
                      setProgram({ ...program, weekdays: Array.from(keys, String) })
                    }
                  >
                    {weekdays.map((day, index) => (
                      <ToggleGroupItem key={day} id={String(index + 1)}>
                        {t(($) => $.schedule.weekdays[day])}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-start`}>{t(($) => $.schedule.start)}</FieldLabel>
                  <Input
                    id={`${id}-start`}
                    type="time"
                    step={1}
                    required
                    value={program.start}
                    disabled={disabled}
                    onChange={(event) => setProgram({ ...program, start: event.target.value })}
                  />
                </Field>
                {(["duration", "total", "male", "female"] as const).map((field) => (
                  <Field key={field}>
                    <FieldLabel htmlFor={`${id}-${field}`}>
                      {field === "duration"
                        ? t(($) => $.settings.preparation.duration)
                        : field === "total"
                          ? t(($) => $.schedule.capacity)
                          : field === "male"
                            ? t(($) => $.schedule.capacityCategories.male)
                            : t(($) => $.schedule.capacityCategories.female)}
                    </FieldLabel>
                    <Input
                      id={`${id}-${field}`}
                      type="number"
                      step={1}
                      min={field === "duration" ? 1 : 0}
                      required={
                        field === "duration" ||
                        field === "total" ||
                        (field === "male" ? !!program.female : !!program.male)
                      }
                      value={program[field]}
                      disabled={disabled}
                      onChange={(event) => setProgram({ ...program, [field]: event.target.value })}
                    />
                  </Field>
                ))}
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor={`${id}-first`}>
                    {collection ? t(($) => $.finance.currency) : t(($) => $.leads.source)}
                  </FieldLabel>
                  <Input
                    id={`${id}-first`}
                    value={first}
                    onChange={(event) => setFirst(event.target.value)}
                    required
                    maxLength={collection ? 3 : 100}
                    pattern={collection ? "[A-Z]{3}" : undefined}
                    disabled={disabled}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-second`}>
                    {collection
                      ? t(($) => $.settings.preparation.paymentMethod)
                      : t(($) => $.leads.interest)}
                  </FieldLabel>
                  {collection ? (
                    <NativeSelect
                      id={`${id}-second`}
                      value={second}
                      onChange={(event) => setSecond(event.target.value)}
                      required
                      disabled={disabled}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.schedule.choose)}
                      </NativeSelectOption>
                      {(["cash", "bank_transfer", "card_pos"] as const).map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {method(value)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      id={`${id}-second`}
                      value={second}
                      onChange={(event) => setSecond(event.target.value)}
                      required
                      maxLength={1000}
                      disabled={disabled}
                    />
                  )}
                </Field>
              </>
            )}
            {error && <p role="alert">{t(($) => $.settings.documentInvalid)}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" isDisabled={disabled || (!selected && rows.length >= 100)}>
                {t(($) => $.settings.preparation.review)}
              </Button>
              {selected && (
                <Button
                  type="button"
                  variant="outline"
                  isDisabled={disabled}
                  onPress={() => review(true)}
                >
                  {t(($) => $.settings.preparation.remove)}
                </Button>
              )}
              {source.level === "center" && family !== "program_templates" && !inherited && (
                <Button
                  type="button"
                  variant="outline"
                  isDisabled={disabled}
                  onPress={() =>
                    onReview(
                      {},
                      [
                        {
                          id: family,
                          title,
                          detail: t(($) => $.settings.preparation.inheritReview),
                        },
                      ],
                      family,
                    )
                  }
                >
                  {t(($) => $.settings.preparation.inherit)}
                </Button>
              )}
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
