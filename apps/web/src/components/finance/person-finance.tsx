"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { financeApi, financeMatches, type FinanceApi } from "../../lib/finance";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FinanceLedger } from "./finance-ledger";
import { CollectionAccess } from "./collection-access";
export function PersonFinance(props: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  api?: FinanceApi;
}) {
  return (
    <FinanceConnection
      key={JSON.stringify([props.scope, props.personId, props.timeZone])}
      {...props}
    />
  );
}
function FinanceConnection({
  scope,
  personId,
  timeZone,
  api = financeApi,
}: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  api?: FinanceApi;
}) {
  const t = useTranslations("finance"),
    id = useId(),
    heading = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false),
    [currency, setCurrency] = useState(""),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0);
  const key = JSON.stringify([query, cursor, revision]);
  const [result, setResult] = useState<{ key: string; view?: FinanceView; error?: string } | null>(
    null,
  );
  const command = useSetupCommand(
    scope,
    `finance:${personId}`,
    () => setRevision((n) => n + 1),
    () => setRevision((n) => n + 1),
  );
  const current = result?.key === key ? result : null;
  useEffect(() => {
    if (!open || !query) return;
    let active = true;
    void api
      .read(scope, personId, query, cursor)
      .then((view) => {
        if (!financeMatches(view, personId, query, scope.centerId)) throw Error("invalidFinance");
        if (active) setResult({ key, view });
      })
      .catch((cause) => {
        if (active) setResult({ key, error: flowError(cause) });
      });
    return () => {
      active = false;
    };
  }, [scope, personId, api, open, query, cursor, key]);
  useEffect(() => {
    if (command.message) heading.current?.focus();
  }, [command.message]);
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("title")}>
      <h3 className="font-semibold outline-none" tabIndex={-1} ref={heading}>
        {t("title")}
      </h3>
      <SetupFeedback command={command} />
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t(open ? "close" : "open")}
      </Button>
      {open && (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = currency.trim().toUpperCase();
              if (!/^[A-Z]{3}$/.test(value)) return;
              setCursor(undefined);
              setQuery(value);
              setRevision((n) => n + 1);
            }}
          >
            <div className="min-w-0 space-y-2">
              <Label htmlFor={id}>{t("currency")}</Label>
              <Input
                id={id}
                value={currency}
                maxLength={3}
                pattern="[A-Za-z]{3}"
                required
                autoComplete="off"
                onChange={(event) => setCurrency(event.target.value)}
              />
            </div>
            <Button className="h-auto min-h-11 max-w-full whitespace-normal">{t("read")}</Button>
          </form>
          {query && (
            <>
              <p className="text-sm text-muted-foreground">
                {t("currencyShown", { currency: query })}
              </p>
              {!current && <output aria-live="polite">{t("loading")}</output>}
              {current?.error &&
                (current.error === "invalidFinance" ? (
                  <p role="alert">{t("invalidFinance")}</p>
                ) : (
                  <FlowError code={current.error} />
                ))}
              {current?.view && (
                <>
                  <FinanceLedger view={current.view} />
                  <CollectionAccess
                    key={key}
                    scope={scope}
                    view={current.view}
                    timeZone={timeZone}
                    api={api}
                    command={command}
                  />
                </>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="h-auto min-h-11 whitespace-normal"
                  onClick={() => {
                    setCursor(undefined);
                    setRevision((n) => n + 1);
                  }}
                >
                  {t("refresh")}
                </Button>
                {current?.view?.movements.next_cursor && (
                  <Button
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal"
                    onClick={() => setCursor(current.view!.movements.next_cursor ?? undefined)}
                  >
                    {t("next")}
                  </Button>
                )}
                {cursor && (
                  <Button
                    variant="outline"
                    className="h-auto min-h-11 whitespace-normal"
                    onClick={() => setCursor(undefined)}
                  >
                    {t("first")}
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
