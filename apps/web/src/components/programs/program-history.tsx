"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey } from "../setup/setup-command";
export function ProgramHistory({ scope, classId }: { scope: SetupScope; classId: string }) {
  const t = useTranslations("program"),
    errors = useTranslations("setup");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    items?: ManagementStateView[];
    next?: string | null;
    error?: string;
  } | null>(null);
  const key = `${scope.actorId}:${scope.orgId}:${scope.centerId}:${classId}:${cursor ?? ""}:${attempt}`;
  useEffect(() => {
    let active = true;
    void setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "program_preview_v1",
      selector: { operation: "program_preview_v1", key: { class_id: classId } },
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    })
      .then((page) => {
        if (active) setResult({ key, items: page.items, next: page.next_cursor });
      })
      .catch((cause) => {
        if (active) setResult({ key, error: errorKey(setupError(cause)) });
      });
    return () => {
      active = false;
    };
  }, [key, scope.orgId, scope.centerId, classId, cursor]);
  const current = result?.key === key ? result : null;
  return (
    <section className="space-y-3" aria-label={t("history")}>
      <h3 className="font-semibold">{t("history")}</h3>
      <p className="text-xs text-muted-foreground">{t("historyHint")}</p>
      {!current && <output aria-live="polite">{t("loading")}</output>}
      {current?.error && <p role="alert">{errors(current.error)}</p>}
      {current?.items?.length === 0 && <p className="text-sm">{t("emptyPrograms")}</p>}
      <ul className="space-y-3">
        {current?.items?.map((item) => {
          const values =
            item.current?.operation === "program_preview_v1" ? item.current.values : null;
          return (
            <li key={item.entity?.id} className="space-y-2 rounded-md border p-3 text-sm">
              {values?.schedule && values.timezone ? (
                <>
                  <p>
                    {values.schedule.starts_on} — {values.schedule.ends_on} ({t("exclusive")})
                  </p>
                  <p>
                    {values.schedule.local_start} · {values.timezone}
                  </p>
                  <p>{values.schedule.weekdays.map((d) => t(`day${d}`)).join(", ")}</p>
                  <p>{t("places", { count: values.schedule.capacity.total })}</p>
                </>
              ) : (
                <p>{t("missingSnapshot")}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setCursor(undefined);
            setAttempt((n) => n + 1);
          }}
        >
          {t("refresh")}
        </Button>
        {current?.next && (
          <Button variant="outline" onClick={() => setCursor(current.next!)}>
            {t("next")}
          </Button>
        )}
      </div>
    </section>
  );
}
