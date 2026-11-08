"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { balanceOperations, type BalanceOperation } from "../../lib/finance-actions";
import { balanceApi, type BalanceApi } from "../../lib/finance-management";
import type { SetupScope } from "../../lib/studio-setup";
const BalanceForm = dynamic(() => import("./balance-form").then((module) => module.BalanceForm));
type Props = {
  scope: SetupScope;
  view: FinanceView;
  timeZone: string;
  onSaved: () => void;
  api?: BalanceApi;
};
export function BalanceActions(props: Props) {
  return (
    <div className="space-y-5">
      {balanceOperations.map((operation) => (
        <BalanceAccess key={operation} {...props} operation={operation} />
      ))}
    </div>
  );
}
function BalanceAccess({
  scope,
  view,
  timeZone,
  onSaved,
  operation,
  api = balanceApi,
}: Props & { operation: BalanceOperation }) {
  const t = useTranslations("finance"),
    format = useFormatter(),
    id = useId();
  const [debtId, setDebtId] = useState(view.debts[0]?.id ?? ""),
    [attempt, setAttempt] = useState(0);
  const [access, setAccess] = useState<{ key: string; allowed?: boolean; failed?: boolean } | null>(
    null,
  );
  const needsDebt = operation !== "student_credit_refund_v1",
    debt = view.debts.find((row) => row.id === debtId);
  const key = JSON.stringify([
    scope,
    view.person_id,
    view.currency,
    needsDebt ? debtId : "",
    attempt,
  ]);
  useEffect(() => {
    if (needsDebt && !debtId) return;
    const lifetime = new AbortController();
    void api
      .access(scope, operation, view.person_id, debtId)
      .then((allowed) => {
        if (!lifetime.signal.aborted) setAccess({ key, allowed });
      })
      .catch(() => {
        if (!lifetime.signal.aborted) setAccess({ key, failed: true });
      });
    return () => lifetime.abort();
  }, [scope, operation, view.person_id, api, debtId, needsDebt, key]);
  if (needsDebt && !view.debts.length) return null;
  const current = access?.key === key ? access : null;
  return (
    <div className="min-w-0 space-y-3 border-t pt-4">
      {needsDebt && (
        <div className="space-y-2">
          <Label htmlFor={id}>{t("actionDebt", { action: t(`balanceKinds.${operation}`) })}</Label>
          <select
            id={id}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={debtId}
            onChange={(event) => setDebtId(event.target.value)}
          >
            {view.debts.map((row, index) => (
              <option key={row.id} value={row.id}>
                {t("debtNumber", { number: index + 1 })} ·{" "}
                {format.dateTime(new Date(row.due_at), { dateStyle: "medium", timeZone })}
              </option>
            ))}
          </select>
        </div>
      )}
      {!current && <output aria-live="polite">{t("loading")}</output>}
      {current?.failed && (
        <div className="space-y-3">
          <p role="alert">
            {t("balancePermissionFailed", { action: t(`balanceKinds.${operation}`) })}
          </p>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {t("retryPermission")}
          </Button>
        </div>
      )}
      {current?.allowed && (
        <section className="min-w-0 space-y-3" aria-label={t(`balanceKinds.${operation}`)}>
          <h4 className="font-semibold">{t(`balanceKinds.${operation}`)}</h4>
          {operation === "student_credit_offset_v1" &&
          (!Number.isSafeInteger(debt?.version) || Number(debt?.version) <= 0) ? (
            <p role="alert">{t("missingDebtVersion")}</p>
          ) : (
            <BalanceForm
              key={`${operation}:${debtId}`}
              operation={operation}
              scope={scope}
              view={view}
              debtId={debtId}
              timeZone={timeZone}
              onSaved={onSaved}
            />
          )}
        </section>
      )}
    </div>
  );
}
