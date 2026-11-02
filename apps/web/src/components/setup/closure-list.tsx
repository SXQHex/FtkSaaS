"use client";
import { useEffect, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import type { ManagementStateView, ResourceRef } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { getClosures, setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey } from "./setup-command";

export function ClosureList({
  scope,
  resource,
  revision,
}: {
  scope: SetupScope;
  resource: ResourceRef;
  revision: number;
}) {
  const t = useTranslations("setup"),
    format = useFormatter();
  const [items, setItems] = useState<ManagementStateView[] | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void getClosures(scope.orgId, scope.centerId!, { kind: resource.kind, id: resource.id })
      .then((rows) => {
        if (active) {
          setItems(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setItems(null);
          setError(errorKey(setupError(cause)));
        }
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, resource.kind, resource.id, revision, retry]);
  return (
    <section className="space-y-4" aria-label={t("closuresTitle")}>
      <h4 className="font-medium">{t("closuresTitle")}</h4>
      <p className="text-sm text-muted-foreground">{t("closuresHint")}</p>
      <Button
        variant="outline"
        onClick={() => {
          setItems(null);
          setError("");
          setRetry((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!items && !error && <output aria-live="polite">{t("loading")}</output>}
      {items?.length === 0 && <p>{t("noClosures")}</p>}
      <ul className="divide-y text-sm">
        {items?.map((item) => {
          const values =
            item.current?.operation === "availability_exception_save_v1"
              ? item.current.values
              : null;
          const interval = values?.interval;
          if (
            !interval ||
            values?.resource?.kind !== resource.kind ||
            values.resource.id !== resource.id
          )
            return (
              <li key={item.entity?.id} role="alert">
                {t("unreadableClosure")}
              </li>
            );
          return (
            <li key={item.entity?.id} className="flex flex-wrap items-center gap-2 py-3">
              <time dateTime={interval.starts_at}>
                {format.dateTime(new Date(interval.starts_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              <span aria-hidden="true">–</span>
              <time dateTime={interval.ends_at}>
                {format.dateTime(new Date(interval.ends_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
