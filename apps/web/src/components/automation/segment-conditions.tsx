"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type { SegmentCondition } from "@ftksaas/api-contracts";
import {
  segmentOperators,
  representableCondition,
  changeSegmentOperator,
} from "../../lib/segment-condition";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
const fields = [
  "active_student",
  "remaining_credits",
  "lead_source",
  "lead_interest",
  "last_attended_at",
  "entitlement_ends_at",
  "center_id",
] as const;
export function SegmentConditions({
  group,
  conditions,
  onChange,
}: {
  group: "all" | "any";
  conditions: SegmentCondition[];
  onChange: (v: SegmentCondition[]) => void;
}) {
  const t = useTranslations("automation"),
    id = useId();
  function update(i: number, row: SegmentCondition) {
    onChange(conditions.map((c, n) => (i === n ? row : c)));
  }
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 font-medium">{t(group === "all" ? "matchAll" : "matchAny")}</legend>
      {conditions.map((c, i) =>
        !representableCondition(c) ? (
          <div key={i}>
            <p>
              {t(c.field)} · {t(c.operator)} · {JSON.stringify(c.value)}
            </p>
            <p>{t("preservedCondition")}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(conditions.filter((_, n) => n !== i))}
            >
              {t("remove")}
            </Button>
          </div>
        ) : (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-field-${i}`}>{t("field")}</Label>
              <select
                id={`${id}-field-${i}`}
                className="min-h-11 w-full rounded-md border bg-background"
                value={c.field}
                onChange={(e) =>
                  update(i, {
                    field: e.target.value as SegmentCondition["field"],
                    operator:
                      e.target.value === "last_attended_at" ||
                      e.target.value === "entitlement_ends_at"
                        ? "lt"
                        : "eq",
                    value:
                      e.target.value === "active_student"
                        ? true
                        : e.target.value === "remaining_credits"
                          ? 0
                          : "",
                  })
                }
              >
                {fields.map((k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`${id}-operator-${i}`}>{t("operator")}</Label>
              <select
                id={`${id}-operator-${i}`}
                className="min-h-11 w-full rounded-md border bg-background"
                value={c.operator}
                onChange={(e) => {
                  const operator = e.target.value as SegmentCondition["operator"];
                  update(i, changeSegmentOperator(c, operator));
                }}
              >
                {segmentOperators(c.field).map((k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ))}
              </select>
            </div>
            {c.operator !== "is_null" && (
              <div>
                <Label htmlFor={`${id}-value-${i}`}>
                  {t(c.operator === "in" ? "inValues" : "value")}
                </Label>
                {c.operator !== "in" && c.field === "active_student" ? (
                  <select
                    id={`${id}-value-${i}`}
                    className="min-h-11 rounded-md border bg-background"
                    value={String(c.value)}
                    onChange={(e) => update(i, { ...c, value: e.target.value === "true" })}
                  >
                    <option value="true">{t("yes")}</option>
                    <option value="false">{t("no")}</option>
                  </select>
                ) : c.operator === "in" ? (
                  <textarea
                    required
                    className="min-h-24 w-full rounded-md border bg-transparent p-3"
                    id={`${id}-value-${i}`}
                    value={Array.isArray(c.value) ? c.value.join("\n") : ""}
                    onChange={(e) => update(i, { ...c, value: e.target.value.split("\n") })}
                  />
                ) : (
                  <Input
                    id={`${id}-value-${i}`}
                    type={c.field === "remaining_credits" ? "number" : "text"}
                    value={
                      typeof c.value === "number" && !Number.isFinite(c.value)
                        ? ""
                        : String(c.value ?? "")
                    }
                    onChange={(e) =>
                      update(i, {
                        ...c,
                        value:
                          c.field === "remaining_credits" ? e.target.valueAsNumber : e.target.value,
                      })
                    }
                  />
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange(conditions.filter((_, n) => n !== i))}
            >
              {t("remove")}
            </Button>
          </div>
        ),
      )}
      <Button
        type="button"
        variant="outline"
        disabled={conditions.length >= 100}
        onClick={() =>
          onChange([...conditions, { field: "active_student", operator: "eq", value: true }])
        }
      >
        {t("addCondition")}
      </Button>
    </fieldset>
  );
}
