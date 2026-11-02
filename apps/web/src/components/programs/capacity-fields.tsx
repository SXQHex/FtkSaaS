"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type { SessionCapacity } from "@ftksaas/api-contracts";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
export function CapacityFields({
  total,
  categories,
  onChange,
}: {
  total: number;
  categories?: SessionCapacity["categories"];
  onChange: (total: number, categories: SessionCapacity["categories"]) => void;
}) {
  const t = useTranslations("program"),
    id = useId();
  const number = (value: string) => (value === "" ? NaN : Number(value));
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${id}-total`}>{t("capacity")}</Label>
        <Input
          id={`${id}-total`}
          type="number"
          required
          min={0}
          step={1}
          value={Number.isNaN(total) ? "" : total}
          onChange={(e) => onChange(number(e.target.value), categories)}
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={!!categories}
          onChange={(e) => onChange(total, e.target.checked ? { male: NaN, female: NaN } : null)}
        />
        {t("categoryCapacity")}
      </label>
      {categories && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["male", "female"] as const).map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`${id}-${key}`}>{t(key)}</Label>
              <Input
                id={`${id}-${key}`}
                type="number"
                required
                min={0}
                step={1}
                value={Number.isNaN(categories[key]) ? "" : categories[key]}
                onChange={(e) => onChange(total, { ...categories, [key]: number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
