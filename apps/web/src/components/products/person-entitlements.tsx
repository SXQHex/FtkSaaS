"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { EntitlementView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { readEntitlements } from "../../lib/products";
import type { SetupScope } from "../../lib/studio-setup";
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
export function PersonEntitlements({
  scope,
  personId,
  read = readEntitlements,
}: {
  scope: SetupScope;
  personId: string;
  read?: typeof readEntitlements;
}) {
  return (
    <EntitlementPanel
      key={JSON.stringify([scope, personId])}
      scope={scope}
      personId={personId}
      read={read}
    />
  );
}
function EntitlementPanel({
  scope,
  personId,
  read,
}: {
  scope: SetupScope;
  personId: string;
  read: typeof readEntitlements;
}) {
  const t = useTranslations("products"),
    [open, setOpen] = useState(false),
    [attempt, setAttempt] = useState(0);
  return (
    <section
      className="min-w-0 space-y-4 border-t pt-5 wrap-anywhere"
      aria-label={t("rightsTitle")}
    >
      <h3 className="font-semibold">{t("rightsTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("rightsHint")}</p>
      <Button
        className={buttonClass}
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? "hideRights" : "showRights")}
      </Button>
      {open && (
        <>
          <EntitlementRows key={attempt} scope={scope} personId={personId} read={read} />
          <Button
            className={buttonClass}
            variant="outline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t("reload")}
          </Button>
        </>
      )}
    </section>
  );
}
function EntitlementRows({
  scope,
  personId,
  read,
}: {
  scope: SetupScope;
  personId: string;
  read: typeof readEntitlements;
}) {
  const t = useTranslations("products"),
    format = useFormatter(),
    [rows, setRows] = useState<EntitlementView[] | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void read(scope, personId)
      .then((items) => {
        if (items.some((row) => row.person_id !== personId)) throw Error("wrongPerson");
        if (active) setRows(items);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, personId, read]);
  function date(value: string) {
    return format.dateTime(new Date(`${value}T12:00:00Z`), {
      timeZone: "UTC",
      dateStyle: "medium",
    });
  }
  if (error) return <p role="alert">{t("rightsError")}</p>;
  if (!rows) return <output>{t("loading")}</output>;
  if (!rows.length) return <p>{t("emptyRights")}</p>;
  return (
    <ul className="space-y-4">
      {rows.map((row, index) => (
        <li key={row.sale_id} className="min-w-0 space-y-3 rounded-lg border p-4">
          <h4 className="font-semibold">
            {t("rightNumber", { number: index + 1 })} ·{" "}
            {t(
              row.kind === "credits"
                ? "creditsKind"
                : row.kind === "timed"
                  ? "timedRight"
                  : "unknownRight",
            )}
          </h4>
          <p className="text-sm">
            {date(row.start_date)} — {date(row.end_date)} · {row.timezone}
          </p>
          <p className="text-sm">
            {t.has(`states.${row.state}`) ? t(`states.${row.state}`) : t("unknownRight")}
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {row.kind === "credits" && (
              <div>
                <dt>{t("available")}</dt>
                <dd>{row.available}</dd>
              </div>
            )}
            <div>
              <dt>{t("reserved")}</dt>
              <dd>{row.reserved}</dd>
            </div>
            <div>
              <dt>{t("consumed")}</dt>
              <dd>{row.consumed}</dd>
            </div>
            <div>
              <dt>{t("deficit")}</dt>
              <dd>{row.deficit}</dd>
            </div>
          </dl>
          {row.kind === "timed" && (
            <p className="text-xs text-muted-foreground">{t("timedHint")}</p>
          )}
          {row.quotas.length > 0 && (
            <ul className="space-y-2 text-sm">
              {row.quotas.map((quota, i) => (
                <li key={i}>
                  {format.dateTime(new Date(quota.starts_at), { dateStyle: "medium" })} —{" "}
                  {format.dateTime(new Date(quota.ends_at), { dateStyle: "medium" })}: {t("quota")}{" "}
                  {quota.limit}, {t("reserved")} {quota.reserved}, {t("consumed")} {quota.consumed}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
