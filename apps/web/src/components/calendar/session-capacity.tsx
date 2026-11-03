"use client";

import { useTranslations } from "next-intl";
import type { SessionCapacityView } from "@ftksaas/api-contracts";
import { Users } from "lucide-react";

type Capacity = Pick<SessionCapacityView, "total" | "held" | "remaining"> &
  Partial<SessionCapacityView>;
const counts = ["total", "held", "remaining"] as const;

export function SessionCapacity({ capacity }: { capacity: Capacity }) {
  const t = useTranslations("calendar");
  return (
    <section className="@container min-w-0 space-y-3 wrap-anywhere" aria-label={t("capacity")}>
      <h3 className="flex items-center gap-2 font-medium">
        <Users className="size-4" aria-hidden="true" />
        {t("capacity")}
      </h3>
      <dl className="grid grid-cols-1 gap-3 rounded-xl border p-4 @min-[17rem]:grid-cols-3">
        {counts.map((key) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{t(`capacityLabels.${key}`)}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{capacity[key]}</dd>
          </div>
        ))}
      </dl>
      {capacity.categories && (
        <div className="grid min-w-0 gap-3 @min-[24rem]:grid-cols-2">
          {(["male", "female"] as const).map((category) => (
            <fieldset key={category} className="min-w-0 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">
                {t(`capacityCategories.${category}`)}
              </legend>
              <dl className="space-y-2 text-sm">
                {counts.map((key) => (
                  <div key={key} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">{t(`capacityLabels.${key}`)}</dt>
                    <dd className="font-medium tabular-nums">
                      {(key === "total"
                        ? capacity.categories?.[category]
                        : key === "held"
                          ? capacity.category_held?.[category]
                          : capacity.category_remaining?.[category]) ?? t("capacityUnavailable")}
                    </dd>
                  </div>
                ))}
              </dl>
            </fieldset>
          ))}
        </div>
      )}
      {capacity.room_capacity != null && (
        <p className="text-xs text-muted-foreground">
          {t("roomCapacity", { count: capacity.room_capacity })}
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">{t("capacityHint")}</p>
    </section>
  );
}
