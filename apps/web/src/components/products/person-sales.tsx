"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { salesApi, type SalesApi } from "../../lib/sales";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { effectMoney } from "../../lib/effect-money";
import { SaleForm } from "./sale-form";
const SaleLifecycle = dynamic(() => import("./sale-lifecycle").then((m) => m.SaleLifecycle));
export function PersonSales({
  scope,
  personId,
  onSaved,
  api = salesApi,
}: {
  scope: SetupScope;
  personId: string;
  onSaved?: () => void;
  api?: SalesApi;
}) {
  return (
    <SaleConnection
      key={JSON.stringify([scope, personId])}
      scope={scope}
      personId={personId}
      onSaved={onSaved}
      api={api}
    />
  );
}
function SaleConnection({
  scope: initialScope,
  personId,
  onSaved,
  api,
}: {
  scope: SetupScope;
  personId: string;
  onSaved?: () => void;
  api: SalesApi;
}) {
  const [scope] = useState(initialScope);
  const [lifecycle, setLifecycle] = useState(false);
  const [sale, setSale] = useState<boolean | null>(null);
  const t = useTranslations("flows"),
    [open, setOpen] = useState(false),
    [revision, setRevision] = useState(0),
    [currency, setCurrency] = useState<string>(),
    heading = useRef<HTMLHeadingElement>(null);
  const command = useSetupCommand(scope, `sale-renew:${personId}`, () => {
    setOpen(false);
    setRevision((n) => n + 1);
    onSaved?.();
  });
  useEffect(() => {
    if (command.message) heading.current?.focus();
  }, [command.message]);
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("sales")}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("sales")}
      </h3>
      <SetupFeedback command={command} />
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {t(open ? "hide" : "openSales")}
      </Button>
      {open && (
        <div className="flex flex-wrap gap-3">
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            variant={sale ? "default" : "outline"}
            aria-pressed={sale === true}
            disabled={command.busy || !!command.pending}
            onClick={() => setSale(true)}
          >
            {t("newSale")}
          </Button>
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            variant={sale === false ? "default" : "outline"}
            aria-pressed={sale === false}
            disabled={command.busy || !!command.pending}
            onClick={() => setSale(false)}
          >
            {t("renewal")}
          </Button>
        </div>
      )}
      {open && (
        <Button
          type="button"
          variant="outline"
          disabled={command.busy || !!command.pending}
          aria-expanded={lifecycle}
          onClick={() => setLifecycle((v) => !v)}
        >
          {t("packageLifecycle")}
        </Button>
      )}
      {open && lifecycle && (
        <SaleLifecycle
          scope={scope}
          personId={personId}
          onSaved={() => {
            setRevision((v) => v + 1);
            onSaved?.();
          }}
        />
      )}
      {open && sale !== null && (
        <SaleForm
          key={`${revision}:${sale}`}
          mode={sale ? "sale" : "renew"}
          scope={scope}
          personId={personId}
          api={api}
          command={command}
          onCurrency={setCurrency}
        />
      )}{" "}
      {revision > 0 && <RenewalRights key={revision} scope={scope} personId={personId} api={api} />}
      {revision > 0 && !currency && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("currency") ?? "")
              .trim()
              .toUpperCase();
            if (/^[A-Z]{3}$/.test(value)) setCurrency(value);
          }}
        >
          <Label htmlFor="renewal-result-currency">{t("financeCurrency")}</Label>
          <Input
            id="renewal-result-currency"
            name="currency"
            required
            pattern="[A-Za-z]{3}"
            maxLength={3}
          />
          <Button className="h-auto min-h-11 max-w-full whitespace-normal">{t("finance")}</Button>
        </form>
      )}
      {revision > 0 && currency && (
        <RenewalFinance
          key={`${revision}:${currency}`}
          scope={scope}
          personId={personId}
          currency={currency}
          api={api}
        />
      )}
    </section>
  );
}
function RenewalRights({
  scope,
  personId,
  api,
}: {
  scope: SetupScope;
  personId: string;
  api: SalesApi;
}) {
  const t = useTranslations("flows"),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api
      .rights(scope, personId)
      .then((rows) => {
        if (rows.some((row) => row.person_id !== personId)) throw Error("invalidForm");
        if (active) setLoaded(true);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, personId, api]);
  return error ? (
    <FlowError code={error} />
  ) : (
    <output>{t(loaded ? "rightsReloaded" : "loading")}</output>
  );
}
function RenewalFinance({
  scope,
  personId,
  currency,
  api,
}: {
  scope: SetupScope;
  personId: string;
  currency: string;
  api: SalesApi;
}) {
  const t = useTranslations("flows"),
    locale = useLocale(),
    [data, setData] = useState<FinanceView | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api
      .finance(scope, personId, currency)
      .then((result) => {
        if (result.person_id !== personId || result.currency !== currency)
          throw Error("invalidForm");
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, personId, currency, api]);
  return (
    <section aria-label={t("finance")} className="space-y-3">
      <h4 className="font-semibold">{t("finance")}</h4>
      {error ? (
        <FlowError code={error} />
      ) : !data ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          <p>
            {t("creditBalance", {
              amount: effectMoney(data.credit_available_minor, currency, locale),
            })}
          </p>
          <ul>
            {data.debts.map((row) => (
              <li key={row.id}>
                {t("debtBalance", { amount: effectMoney(row.remaining_minor, currency, locale) })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
