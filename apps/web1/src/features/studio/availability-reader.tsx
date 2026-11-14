import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AvailabilityPanel, type AvailabilityDraft } from "./availability-panel";
import { readStudioAvailability } from "./studio-reads";
import type { StudioScope } from "./studio";
import type { StudioInstructor } from "./studio-view";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";

export function StudioAvailabilityReader({
  scope,
  instructors,
}: {
  scope: StudioScope;
  instructors: StudioInstructor[];
}) {
  const { t } = useTranslation();
  const [personId, setPersonId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const selected = instructors.some((item) => item.id === personId);
  const query = useQuery({
    queryKey: ["studio-availability", scope.accountId, scope.orgId, scope.centerId, personId],
    queryFn: () => readStudioAvailability(scope, { kind: "person", id: personId }),
    enabled: Boolean(personId && selected),
    retry: false,
  });
  const rows = selected && !query.isError ? query.data : undefined;
  const periods = [
    ...new Set(
      rows?.map((item) => JSON.stringify([item.rule.valid_from, item.rule.valid_until ?? null])) ??
        [],
    ),
  ];
  const initialByInstructor = useMemo((): Record<string, AvailabilityDraft> => {
    if (!personId || !periodId || !rows) return {};
    const selected = rows.filter(
      (item) => JSON.stringify([item.rule.valid_from, item.rule.valid_until ?? null]) === periodId,
    );
    const first = selected[0];
    if (!first) return {};
    return {
      [personId]: {
        validFrom: first.rule.valid_from,
        validUntil: first.rule.valid_until ?? "",
        days: Array.from({ length: 7 }, (_, index) => {
          const rules = selected.filter((item) => item.rule.weekdays.includes(index + 1));
          return {
            enabled: rules.length > 0,
            intervals: rules.map((item) => ({
              id: item.id,
              from: item.rule.local_start,
              to: item.rule.local_end,
            })),
          };
        }),
      },
    };
  }, [personId, periodId, rows]);
  const notice = !personId
    ? undefined
    : query.isError
      ? t(($) => $.studio.resourceReadError)
      : query.isPending
        ? t(($) => $.studio.loading)
        : !rows?.length
          ? t(($) => $.studio.noAvailabilityRules)
          : !periodId
            ? t(($) => $.studio.chooseAvailabilityPeriod)
            : t(($) => $.studio.availabilityReadOnly);
  return (
    <AvailabilityPanel
      instructors={instructors}
      initialByInstructor={initialByInstructor}
      readOnly
      valuesKnown={Boolean(rows && (rows.length === 0 || initialByInstructor[personId]))}
      loading={query.isFetching}
      notice={notice}
      onSelectInstructor={(id) => {
        setPersonId(id);
        setPeriodId("");
      }}
      periodControl={
        <div className="flex flex-wrap items-end gap-3 px-5 pb-3">
          {periods.length > 0 && (
            <Field className="w-full gap-1.5 sm:max-w-sm">
              <FieldLabel htmlFor="availability-period">
                {t(($) => $.studio.availabilityPeriod)}
              </FieldLabel>
              <NativeSelect
                id="availability-period"
                className="w-full"
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
              >
                <option value="">{t(($) => $.studio.chooseAvailabilityPeriod)}</option>
                {periods.map((period) => {
                  const [from, until] = JSON.parse(period) as [string, string | null];
                  return (
                    <option key={period} value={period}>
                      {from} – {until ?? t(($) => $.studio.noEndDate)}
                    </option>
                  );
                })}
              </NativeSelect>
            </Field>
          )}
          {query.isError && (
            <Button
              variant="outline"
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.studio.retry)}
            </Button>
          )}
        </div>
      }
    />
  );
}
