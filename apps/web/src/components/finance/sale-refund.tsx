"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { EntitlementView, Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { refundApi, type RefundApi } from "../../lib/finance-management";
import { refundSourcesMatch, refundMatches, saleRefundCommand } from "../../lib/sale-refund";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FinancePreviewReview } from "./finance-preview-review";
type Props = {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  onSaved: () => void;
  api?: RefundApi;
};
export function SaleRefund(props: Props) {
  return (
    <RefundSources key={JSON.stringify([props.scope, props.personId, props.timeZone])} {...props} />
  );
}
function RefundSources({ scope, personId, timeZone, onSaved, api = refundApi }: Props) {
  const t = useTranslations("finance"),
    id = useId();
  const [result, setResult] = useState<{ rows?: EntitlementView[]; error?: string } | null>(null),
    [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState("");
  useEffect(() => {
    const lifetime = new AbortController();
    void api
      .sales(scope, personId)
      .then((rows) => {
        if (!refundSourcesMatch(rows, personId)) throw Error("invalidFinance");
        if (!lifetime.signal.aborted) setResult({ rows });
      })
      .catch((cause) => {
        if (!lifetime.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => lifetime.abort();
  }, [scope, personId, api, attempt]);
  const rows = result?.rows,
    sale = rows?.find((row) => row.sale_id === selected) ?? rows?.[0];
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("saleRefund")}>
      <h4 className="font-semibold">{t("saleRefund")}</h4>
      {!result && <output aria-live="polite">{t("loading")}</output>}
      {result?.error && (
        <>
          <FlowError code={result.error} />
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setSelected("");
              setAttempt((n) => n + 1);
            }}
          >
            {t("refresh")}
          </Button>
        </>
      )}
      {rows?.length === 0 && <p>{t("noRefundSale")}</p>}
      {sale && rows && (
        <>
          <div className="space-y-2">
            <Label htmlFor={id}>{t("refundSource")}</Label>
            <select
              id={id}
              className="min-h-11 w-full rounded-md border bg-background px-3"
              value={sale.sale_id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {rows.map((row, index) => (
                <option key={row.sale_id} value={row.sale_id}>
                  {t("saleNumber", { number: index + 1 })} · {row.start_date} — {row.end_date}
                </option>
              ))}
            </select>
          </div>
          <RefundPermission
            key={sale.sale_id}
            scope={scope}
            sale={sale}
            timeZone={timeZone}
            onSaved={onSaved}
            api={api}
          />
        </>
      )}
    </section>
  );
}
function RefundPermission({
  scope,
  sale,
  timeZone,
  onSaved,
  api,
}: {
  scope: SetupScope;
  sale: EntitlementView;
  timeZone: string;
  onSaved: () => void;
  api: RefundApi;
}) {
  const t = useTranslations("finance"),
    [access, setAccess] = useState<boolean | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const lifetime = new AbortController();
    void api
      .access(scope, sale.sale_id)
      .then((value) => {
        if (!lifetime.signal.aborted) setAccess(value);
      })
      .catch(() => {
        if (!lifetime.signal.aborted) setFailed(true);
      });
    return () => lifetime.abort();
  }, [api, scope, sale.sale_id, attempt]);
  if (failed)
    return (
      <div className="space-y-3">
        <p role="alert">{t("refundPermissionFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAccess(null);
            setAttempt((n) => n + 1);
          }}
        >
          {t("retryPermission")}
        </Button>
      </div>
    );
  if (access === null) return <output aria-live="polite">{t("loading")}</output>;
  return access ? (
    <RefundForm scope={scope} sale={sale} timeZone={timeZone} onSaved={onSaved} api={api} />
  ) : null;
}
function RefundForm({
  scope,
  sale,
  timeZone,
  onSaved,
  api,
}: {
  scope: SetupScope;
  sale: EntitlementView;
  timeZone: string;
  onSaved: () => void;
  api: RefundApi;
}) {
  const t = useTranslations("finance"),
    id = useId();
  const [request, setRequest] = useState<{ reason: string } | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState("");
  const command = useSetupCommand(scope, `sale-refund:${sale.sale_id}`, onSaved, onSaved);
  const disabled = command.busy || !!command.pending,
    loading = !!request && !preview && !error;
  function reset() {
    setRequest(null);
    setPreview(null);
    setError("");
  }
  useEffect(() => {
    if (!request) return;
    const lifetime = new AbortController();
    void api
      .preview(scope, sale.sale_id, request.reason)
      .then((value) => {
        if (!refundMatches(value, sale.sale_id)) throw Error("invalidFinance");
        if (!lifetime.signal.aborted) setPreview(value);
      })
      .catch((cause) => {
        if (!lifetime.signal.aborted) setError(flowError(cause));
      });
    return () => lifetime.abort();
  }, [api, scope, sale.sale_id, request]);
  return (
    <div className="space-y-4">
      <SetupFeedback command={command} />
      <p className="text-sm text-muted-foreground">{t("saleRefundHint")}</p>
      <p>
        {t("refundRights", {
          available: sale.available,
          reserved: sale.reserved,
          consumed: sale.consumed,
        })}
      </p>
      <form
        className="space-y-3"
        onChange={reset}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || loading) return;
          const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
          reset();
          if (!reason || reason.length > 10000) {
            setError("invalidFinance");
            return;
          }
          setRequest({ reason });
        }}
      >
        <fieldset disabled={disabled} className="space-y-3">
          <Label htmlFor={id}>{t("correctionReason")}</Label>
          <Input id={id} name="reason" required maxLength={10000} />
          <Button disabled={loading} className="h-auto min-h-11 max-w-full whitespace-normal">
            {t("reviewSaleRefund")}
          </Button>
        </fieldset>
      </form>
      {loading && <output aria-live="polite">{t("loading")}</output>}
      {error &&
        (error === "invalidFinance" ? (
          <p role="alert">{t("invalidFinancePreview")}</p>
        ) : (
          <FlowError code={error} />
        ))}
      {preview && request && (
        <FinancePreviewReview
          key={preview.id}
          timeZone={timeZone}
          preview={preview}
          disabled={disabled}
          onBack={reset}
          onApply={() => {
            const write = saleRefundCommand(scope, preview);
            reset();
            void command.run(write);
          }}
        >
          <p>
            {t("saleRefund")}: {sale.start_date} — {sale.end_date}
          </p>
          <p>{request.reason}</p>
          <p>{t("saleRefundHint")}</p>
          <p>
            {t("refundRights", {
              available: sale.available,
              reserved: sale.reserved,
              consumed: sale.consumed,
            })}
          </p>
        </FinancePreviewReview>
      )}
    </div>
  );
}
