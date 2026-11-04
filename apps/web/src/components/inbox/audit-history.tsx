"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { EntityRef } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { listAudit } from "../../lib/inbox";
import type { SetupScope } from "../../lib/studio-setup";

export function AuditHistory({
  scope,
  subject,
  list = listAudit,
}: {
  scope: SetupScope;
  subject: EntityRef;
  list?: typeof listAudit;
}) {
  const t = useTranslations("inbox");
  const format = useFormatter();
  const formId = useId();
  const [interval, setInterval] = useState(() => {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 30);
    return { starts_at: start.toISOString(), ends_at: end.toISOString() };
  });
  const [cursor, setCursor] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState<Awaited<ReturnType<typeof listAudit>> | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void list(scope, subject, interval, cursor)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, subject, interval, cursor, retry, list]);
  function reset() {
    setPage(null);
    setError(false);
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const start = new Date(`${data.get("from")}T00:00:00Z`);
    const end = new Date(`${data.get("until")}T00:00:00Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      setPage(null);
      setError(true);
      return;
    }
    reset();
    setCursor(undefined);
    setInterval({ starts_at: start.toISOString(), ends_at: end.toISOString() });
  }
  return (
    <section aria-label={t("history")} className="space-y-5">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={`${formId}-from`}>{t("from")}</Label>
          <Input
            id={`${formId}-from`}
            name="from"
            type="date"
            required
            defaultValue={interval.starts_at.slice(0, 10)}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={`${formId}-until`}>{t("until")}</Label>
          <Input
            id={`${formId}-until`}
            name="until"
            type="date"
            required
            defaultValue={interval.ends_at.slice(0, 10)}
          />
        </div>
        <Button type="submit" variant="outline">
          {t("filter")}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t("utcRange")}</p>
      {error ? (
        <p role="alert">{t("historyError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          {page.items.length === 0 ? (
            <p>{t("emptyHistory")}</p>
          ) : (
            <ol className="divide-y">
              {page.items.map((item) => (
                <li key={item.id} className="space-y-2 py-4">
                  <p className="font-medium break-words">{item.actor_display}</p>
                  <p className="text-sm break-all">
                    {t.has(`actions.${item.action}`)
                      ? t(`actions.${item.action}`)
                      : t("recordAction")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(item.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  {item.reason && (
                    <p className="whitespace-pre-wrap break-words text-sm">{item.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
          {page.next_cursor && (
            <Button
              variant="outline"
              onClick={() => {
                reset();
                setCursor(page.next_cursor ?? undefined);
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setCursor(undefined);
          setRetry((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
    </section>
  );
}
