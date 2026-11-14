import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon, XIcon } from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { NativeSelect } from "../../components/ui/native-select";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { StudioInstructor } from "./studio-view";

const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
type Interval = { id: number | string; from: string; to: string };
type DayDraft = { enabled: boolean; intervals: Interval[] };
export interface AvailabilityDraft {
  days: DayDraft[];
  validFrom: string;
  validUntil: string;
}
const emptyWeek = (): DayDraft[] => weekdays.map(() => ({ enabled: false, intervals: [] }));

export function AvailabilityPanel({
  instructors,
  initialByInstructor,
}: {
  instructors: StudioInstructor[];
  initialByInstructor: Record<string, AvailabilityDraft>;
}) {
  const { t } = useTranslation();
  const [instructorId, setInstructorId] = useState("");
  const [week, setWeek] = useState(emptyWeek);
  const [sequence, setSequence] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const instructor = instructors.find((item) => item.id === instructorId);
  const enabled = Boolean(instructor?.active);
  const changeDay = (index: number, next: DayDraft) => {
    setWeek((current) => current.map((day, i) => (i === index ? next : day)));
    setDirty(true);
  };
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t(($) => $.studio.weeklyAvailability)}</h2>
          <p className="text-[13px] text-muted-foreground">
            {t(($) => $.studio.availabilityDescription)}
          </p>
        </div>
        <Field className="w-full gap-1 sm:w-48">
          <FieldLabel htmlFor="availability-instructor">{t(($) => $.studio.instructor)}</FieldLabel>
          <NativeSelect
            id="availability-instructor"
            className="w-full"
            value={instructorId}
            disabled={dirty}
            onChange={(event) => {
              setInstructorId(event.target.value);
              const initial = initialByInstructor[event.target.value];
              setWeek(initial?.days ?? emptyWeek());
              setValidFrom(initial?.validFrom ?? "");
              setValidUntil(initial?.validUntil ?? "");
              setDirty(false);
            }}
          >
            <option value="">{t(($) => $.studio.chooseInstructor)}</option>
            {instructors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {instructor && !instructor.active && (
          <Alert>
            <AlertDescription>{t(($) => $.studio.inactiveAvailability)}</AlertDescription>
          </Alert>
        )}
        <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="availability-valid-from">
              {t(($) => $.studio.validFrom)}
            </FieldLabel>
            <Input
              id="availability-valid-from"
              name="validFrom"
              type="date"
              disabled={!enabled}
              required
              value={validFrom}
              onChange={(event) => {
                setValidFrom(event.target.value);
                setDirty(true);
              }}
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="availability-valid-until">
              {t(($) => $.studio.validUntil)}
            </FieldLabel>
            <Input
              id="availability-valid-until"
              name="validUntil"
              type="date"
              disabled={!enabled}
              value={validUntil}
              onChange={(event) => {
                setValidUntil(event.target.value);
                setDirty(true);
              }}
            />
          </Field>
        </FieldGroup>
        <div className="flex flex-col divide-y divide-border">
          {weekdays.map((day, index) => {
            const draft = week[index]!;
            return (
              <div key={day} className="grid min-w-0 gap-3 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <span id={`availability-${day}`}>{t(($) => $.studio.days[day])}</span>
                  <Switch
                    aria-labelledby={`availability-${day}`}
                    isDisabled={!enabled}
                    isSelected={draft.enabled}
                    onChange={(value) => changeDay(index, { ...draft, enabled: value })}
                  />
                </div>
                <div className="flex min-w-0 flex-wrap items-start gap-3">
                  {draft.intervals.map((interval) => (
                    <div className="flex min-w-0 flex-wrap items-end gap-2" key={interval.id}>
                      <Field className="w-28 gap-1">
                        <FieldLabel
                          className="text-xs"
                          htmlFor={`availability-${day}-${interval.id}-from`}
                        >
                          {t(($) => $.studio.start)}
                        </FieldLabel>
                        <Input
                          type="time"
                          id={`availability-${day}-${interval.id}-from`}
                          value={interval.from}
                          disabled={!enabled || !draft.enabled}
                          onChange={(event) =>
                            changeDay(index, {
                              ...draft,
                              intervals: draft.intervals.map((item) =>
                                item.id === interval.id
                                  ? { ...item, from: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Field className="w-28 gap-1">
                        <FieldLabel
                          className="text-xs"
                          htmlFor={`availability-${day}-${interval.id}-to`}
                        >
                          {t(($) => $.studio.end)}
                        </FieldLabel>
                        <Input
                          type="time"
                          id={`availability-${day}-${interval.id}-to`}
                          value={interval.to}
                          disabled={!enabled || !draft.enabled}
                          onChange={(event) =>
                            changeDay(index, {
                              ...draft,
                              intervals: draft.intervals.map((item) =>
                                item.id === interval.id
                                  ? { ...item, to: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </Field>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t(($) => $.studio.removeInterval, {
                          day: t(($) => $.studio.days[day]),
                        })}
                        isDisabled={!enabled || !draft.enabled}
                        onPress={() =>
                          changeDay(index, {
                            ...draft,
                            intervals: draft.intervals.filter((item) => item.id !== interval.id),
                          })
                        }
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                  {!draft.enabled && (
                    <span className="py-2 text-xs text-muted-foreground">
                      {t(($) => $.studio.notAvailable)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={!enabled || !draft.enabled}
                    onPress={() => {
                      setSequence(sequence + 1);
                      changeDay(index, {
                        ...draft,
                        intervals: [...draft.intervals, { id: sequence, from: "", to: "" }],
                      });
                    }}
                  >
                    <PlusIcon />
                    {t(($) => $.studio.addInterval)}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <Button
            variant="ghost"
            size="sm"
            isDisabled={!enabled || !week[0]?.enabled || !week[0].intervals.length}
            onPress={() => {
              setWeek((current) =>
                current.map((day, index) =>
                  index > 0 && index < 5
                    ? {
                        ...current[0]!,
                        intervals: current[0]!.intervals.map((item) => ({ ...item })),
                      }
                    : day,
                ),
              );
              setDirty(true);
            }}
          >
            {t(($) => $.studio.copyMonday)}
          </Button>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            {t(($) => $.studio.programImpact)}
          </h3>
          <p className="text-[13px] text-muted-foreground">{t(($) => $.studio.impactPending)}</p>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {dirty ? t(($) => $.studio.unsaved) : t(($) => $.studio.unchanged)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            isDisabled={!dirty}
            onPress={() => {
              const initial = initialByInstructor[instructorId];
              setWeek(initial?.days ?? emptyWeek());
              setValidFrom(initial?.validFrom ?? "");
              setValidUntil(initial?.validUntil ?? "");
              setDirty(false);
            }}
          >
            {t(($) => $.studio.undo)}
          </Button>
          <Button size="sm" isDisabled>
            {t(($) => $.studio.save)}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
