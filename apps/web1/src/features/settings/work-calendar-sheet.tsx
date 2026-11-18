import { workCalendarDays } from "./work-calendar";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Field, FieldLabel, FieldSet, FieldLegend } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import type { CenterWorkCalendar } from "../../lib/api-contracts/generated";
export type WorkCalendarDraft =
  | (Omit<CenterWorkCalendar, "rules"> & {
      rules: (Omit<CenterWorkCalendar["rules"][number], "weekdays"> & { weekdays: number[] })[];
    })
  | null;

export function WorkCalendarSheet({
  value,
  timezone,
  disabled,
  editable,
  known,
  notice,
  onValue,
  onEnabled,
  onReview,
  onClose,
}: {
  value: WorkCalendarDraft;
  timezone?: string;
  disabled: boolean;
  editable: boolean;
  known: boolean;
  notice: ReactNode;
  onValue: (value: WorkCalendarDraft) => void;
  onEnabled: (enabled: boolean) => void;
  onReview: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    prefix = useId();
  const update = (
    index: number,
    patch: Partial<NonNullable<WorkCalendarDraft>["rules"][number]>,
  ) => {
    if (value)
      onValue({
        ...value,
        rules: value.rules.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      });
  };
  return (
    <Sheet
      isOpen
      isDismissable={!disabled}
      isKeyboardDismissDisabled={disabled}
      onOpenChange={(open) => {
        if (!open && !disabled) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.workCalendar.title)}</SheetTitle>
        <SheetDescription>
          {t(($) => $.workCalendar.description)} {timezone}
        </SheetDescription>
      </SheetHeader>
      <form
        aria-label={t(($) => $.workCalendar.title)}
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          onReview();
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-4">
          {notice}
          <Field orientation="horizontal">
            <Checkbox
              id={`${prefix}-enabled`}
              isSelected={value !== null}
              isIndeterminate={!known}
              name="work-calendar-enabled"
              isDisabled={disabled || !editable}
              onChange={onEnabled}
            />
            <FieldLabel htmlFor={`${prefix}-enabled`}>
              {t(($) => $.workCalendar.enabled)}
            </FieldLabel>
          </Field>
          {value?.rules.map((row, index) => (
            <FieldSet key={index} disabled={disabled || !editable}>
              <FieldLegend>{t(($) => $.workCalendar.rule, { number: index + 1 })}</FieldLegend>
              <div className="grid grid-cols-2 gap-3">
                {workCalendarDays.map((day, i) => (
                  <Field key={day} orientation="horizontal">
                    <Checkbox
                      id={`${prefix}-${index}-${day}`}
                      isSelected={row.weekdays.includes(i + 1)}
                      name={`weekdays-${index}`}
                      value={String(i + 1)}
                      isDisabled={disabled || !editable}
                      onChange={(checked) =>
                        update(index, {
                          weekdays: checked
                            ? [...row.weekdays, i + 1]
                            : row.weekdays.filter((d) => d !== i + 1),
                        })
                      }
                    />
                    <FieldLabel htmlFor={`${prefix}-${index}-${day}`}>
                      {t(($) => $.studio.days[day])}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
              <Field>
                <FieldLabel htmlFor={`${prefix}-${index}-start`}>
                  {t(($) => $.workCalendar.start)}
                </FieldLabel>
                <Input
                  id={`${prefix}-${index}-start`}
                  name={`start-${index}`}
                  type="time"
                  step={1}
                  required
                  value={row.local_start}
                  onChange={(e) =>
                    update(index, {
                      local_start:
                        e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value,
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-${index}-end`}>
                  {t(($) => $.workCalendar.end)}
                </FieldLabel>
                <Input
                  id={`${prefix}-${index}-end`}
                  name={`end-${index}`}
                  type="time"
                  step={1}
                  required
                  disabled={row.local_end === "24:00:00"}
                  value={row.local_end === "24:00:00" ? "" : row.local_end}
                  onChange={(e) =>
                    update(index, {
                      local_end:
                        e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value,
                    })
                  }
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id={`${prefix}-${index}-midnight`}
                  isSelected={row.local_end === "24:00:00"}
                  name={`midnight-${index}`}
                  isDisabled={disabled || !editable}
                  onChange={(end) => update(index, { local_end: end ? "24:00:00" : "" })}
                />
                <FieldLabel htmlFor={`${prefix}-${index}-midnight`}>
                  {t(($) => $.workCalendar.midnight)}
                </FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-${index}-from`}>
                  {t(($) => $.workCalendar.from)}
                </FieldLabel>
                <Input
                  id={`${prefix}-${index}-from`}
                  name={`from-${index}`}
                  type="date"
                  required
                  value={row.valid_from}
                  onChange={(e) => update(index, { valid_from: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${prefix}-${index}-until`}>
                  {t(($) => $.workCalendar.until)}
                </FieldLabel>
                <Input
                  id={`${prefix}-${index}-until`}
                  name={`until-${index}`}
                  type="date"
                  value={row.valid_until ?? ""}
                  onChange={(e) => update(index, { valid_until: e.target.value || null })}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                isDisabled={disabled || !editable}
                onPress={() =>
                  onValue({ ...value, rules: value.rules.filter((_, i) => i !== index) })
                }
              >
                {t(($) => $.workCalendar.remove)}
              </Button>
            </FieldSet>
          ))}
          {value && (
            <Button
              type="button"
              variant="outline"
              isDisabled={disabled || !editable || value.rules.length >= 100}
              onPress={() =>
                onValue({
                  ...value,
                  rules: [
                    ...value.rules,
                    {
                      weekdays: [],
                      local_start: "",
                      local_end: "",
                      valid_from: "",
                      valid_until: null,
                    },
                  ],
                })
              }
            >
              {t(($) => $.workCalendar.add)}
            </Button>
          )}
          {value && value.closures.length > 0 && (
            <div>
              <p className="font-medium">{t(($) => $.workCalendar.preservedClosures)}</p>
              <ul className="space-y-2">
                {value.closures.map((closure, i) => (
                  <li key={i} className="break-words">
                    {timezone &&
                      new Intl.DateTimeFormat("tr-TR", {
                        timeZone: timezone,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(closure.starts_at))}{" "}
                    —{" "}
                    {timezone &&
                      new Intl.DateTimeFormat("tr-TR", {
                        timeZone: timezone,
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(closure.ends_at))}
                    : {closure.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <SheetFooter className="flex-wrap">
          <Button type="button" variant="outline" isDisabled={disabled} onPress={onClose}>
            {t(($) => $.settings.discard)}
          </Button>
          <Button type="submit" isDisabled={disabled || !editable}>
            {t(($) => $.workCalendar.review)}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}
