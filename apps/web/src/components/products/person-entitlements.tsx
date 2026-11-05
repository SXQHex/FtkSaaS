"use client";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { EntitlementView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { readEntitlements } from "../../lib/products";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { RightsManagement } from "./rights-management";
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
export function PersonEntitlements({
  scope,
  personId,
  read = readEntitlements,
  management = false,
  readRevision = 0,
  onSaved,
}: {
  scope: SetupScope;
  personId: string;
  read?: typeof readEntitlements;
  management?: boolean;
  readRevision?: number;
  onSaved?: () => void;
}) {
  return (
    <EntitlementConnection
      key={JSON.stringify([scope, personId])}
      scope={scope}
      personId={personId}
      read={read}
      management={management}
      readRevision={readRevision}
      onSaved={onSaved}
    />
  );
}
function EntitlementConnection({
  scope,
  personId,
  read,
  management,
  readRevision,
  onSaved,
}: {
  scope: SetupScope;
  personId: string;
  read: typeof readEntitlements;
  management: boolean;
  readRevision: number;
  onSaved?: () => void;
}) {
  return management ? (
    <ManagedEntitlements
      scope={scope}
      personId={personId}
      read={read}
      onSaved={onSaved}
      readRevision={readRevision}
    />
  ) : (
    <EntitlementPanel scope={scope} personId={personId} read={read} />
  );
}
function ManagedEntitlements({
  scope,
  personId,
  read,
  onSaved,
  readRevision,
}: {
  scope: SetupScope;
  personId: string;
  read: typeof readEntitlements;
  onSaved?: () => void;
  readRevision: number;
}) {
  const [revision, setRevision] = useState(0);
  const command = useSetupCommand(scope, `rights:${personId}`, () => {
    setRevision((n) => n + 1);
    onSaved?.();
  });
  return (
    <EntitlementPanel
      scope={scope}
      personId={personId}
      read={read}
      command={command}
      revision={revision + readRevision}
    />
  );
}
function EntitlementPanel({
  scope,
  personId,
  read,
  command,
  revision = 0,
}: {
  scope: SetupScope;
  personId: string;
  read: typeof readEntitlements;
  command?: ReturnType<typeof useSetupCommand>;
  revision?: number;
}) {
  const t = useTranslations("products"),
    [open, setOpen] = useState(false),
    [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (command?.message) heading.current?.focus();
  }, [command?.message, revision]);
  return (
    <section
      className="min-w-0 space-y-4 border-t pt-5 wrap-anywhere"
      aria-label={t("rightsTitle")}
    >
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("rightsTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("rightsHint")}</p>
      <Button
        className={buttonClass}
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? "hideRights" : "showRights")}
      </Button>
      {command && <SetupFeedback command={command} />}
      {open && (
        <>
          <EntitlementRows
            key={`${attempt}:${revision}`}
            scope={scope}
            personId={personId}
            read={read}
            command={command}
          />
          <Button
            className={buttonClass}
            variant="outline"
            disabled={command?.busy || !!command?.pending}
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
  command,
}: {
  scope: SetupScope;
  personId: string;
  read: typeof readEntitlements;
  command?: ReturnType<typeof useSetupCommand>;
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

  return (
    <>
      {!rows.length && <p>{t("emptyRights")}</p>}
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
                    {format.dateTime(new Date(quota.ends_at), { dateStyle: "medium" })}:{" "}
                    {t("quota")} {quota.limit}, {t("reserved")} {quota.reserved}, {t("consumed")}{" "}
                    {quota.consumed}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {command && (
        <RightsManagement scope={scope} personId={personId} rows={rows} command={command} />
      )}
    </>
  );
}
