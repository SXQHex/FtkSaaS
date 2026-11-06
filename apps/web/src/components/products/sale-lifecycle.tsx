"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { EntitlementView, Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { readEntitlements } from "../../lib/products";
import { refundSourcesMatch } from "../../lib/sale-refund";
import {
  lifecycleApi,
  lifecycleCommand,
  lifecycleMatches,
  type LifecycleApi,
  type LifecycleKind,
} from "../../lib/sale-lifecycle";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { FinancePreviewReview } from "../finance/finance-preview-review";
export function SaleLifecycle(props: {
  scope: SetupScope;
  personId: string;
  onSaved: () => void;
  read?: typeof readEntitlements;
  api?: LifecycleApi;
}) {
  return <LifecycleConnection key={JSON.stringify([props.scope, props.personId])} {...props} />;
}
function LifecycleConnection({
  scope: initialScope,
  personId,
  onSaved,
  read = readEntitlements,
  api = lifecycleApi,
}: Parameters<typeof SaleLifecycle>[0]) {
  const [scope] = useState(initialScope),
    t = useTranslations("saleLifecycle"),
    formatDate = useFormatter(),
    id = useId();
  const [result, setResult] = useState<{ rows?: EntitlementView[]; error?: string } | null>(null),
    [attempt, setAttempt] = useState(0),
    [saleId, setSaleId] = useState("");
  const [kind, setKind] = useState<LifecycleKind | "">(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [freezeId, setFreezeId] = useState(""),
    [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    lifetime = useRef(true);
  useEffect(() => {
    lifetime.current = true;
    return () => {
      lifetime.current = false;
    };
  }, []);
  const command = useSetupCommand(
    scope,
    `sale-lifecycle:${personId}`,
    () => {
      setPreview(null);
      setResult(null);
      setSaleId("");
      setKind("");
      setAttempt((v) => v + 1);
      onSaved();
    },
    () => {
      setPreview(null);
      setResult(null);
      setAttempt((v) => v + 1);
    },
  );
  useEffect(() => {
    const life = new AbortController();
    void read(scope, personId)
      .then((rows) => {
        if (
          !refundSourcesMatch(rows, personId) ||
          rows.some((row) =>
            row.freezes?.some((f) => f.org_id !== scope.orgId || f.sale_id !== row.sale_id),
          )
        )
          throw Error("invalidLifecycle");
        for (const row of rows) {
          new Intl.DateTimeFormat("en", { timeZone: row.timezone });
          if (
            !validDate(row.start_date) ||
            !validDate(row.end_date) ||
            row.freezes?.some(
              (f) =>
                !Number.isFinite(Date.parse(f.starts_at)) ||
                !Number.isFinite(Date.parse(f.planned_end)),
            )
          )
            throw Error("invalidLifecycle");
        }
        if (!life.signal.aborted) setResult({ rows });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [scope, personId, read, attempt]);
  const sale = result?.rows?.find((row) => row.sale_id === saleId);
  const freezes =
    sale?.freezes?.filter((f) => f.state === "active" || f.state === "scheduled") ?? [];
  const disabled = busy || command.busy || !!command.pending;
  function reset() {
    setPreview(null);
    setError("");
  }
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" aria-label={t("title")}>
      <h4 className="font-semibold">{t("title")}</h4>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <SetupFeedback command={command} />
      {!result && <output aria-live="polite">{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          reset();
          setSaleId("");
          setResult(null);
          setAttempt((v) => v + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {result?.rows?.length === 0 && <p>{t("empty")}</p>}
      {!!result?.rows?.length && (
        <>
          <label htmlFor={`${id}-sale`} className="block space-y-2 text-sm">
            <span>{t("source")}</span>
            <select
              id={`${id}-sale`}
              required
              disabled={disabled}
              value={saleId}
              className="min-h-11 w-full rounded-md border bg-background px-3"
              onChange={(e) => {
                reset();
                setKind("");
                setSaleId(e.target.value);
                setFreezeId("");
                setStart("");
                setEnd("");
                setReason("");
              }}
            >
              <option value="">{t("choose")}</option>
              {result.rows.map((row, i) => (
                <option key={row.sale_id} value={row.sale_id}>
                  {t("sale", { number: i + 1 })} · {row.start_date} — {row.end_date}
                </option>
              ))}
            </select>
          </label>
          {sale && (
            <>
              <p className="text-sm">
                {sale.timezone} ·{" "}
                {t("balances", {
                  available: sale.available,
                  reserved: sale.reserved,
                  consumed: sale.consumed,
                })}
              </p>
              {sale.sale_state !== "active" ? (
                <p role="alert">{t("notActive")}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(["freeze", "freeze_end", "terminate"] as LifecycleKind[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={kind === value ? "default" : "outline"}
                        disabled={disabled}
                        aria-pressed={kind === value}
                        onClick={() => {
                          reset();
                          setKind(value);
                          setStart("");
                          setEnd("");
                          setFreezeId("");
                          setReason("");
                        }}
                      >
                        {t(value)}
                      </Button>
                    ))}
                  </div>
                  {kind && !preview && (
                    <form
                      className="space-y-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (disabled || lock.current || !reason.trim()) return;
                        const freeze = freezes.find((f) => f.id === freezeId);
                        if (
                          (kind === "freeze" &&
                            (!validDate(start) || !validDate(end) || start >= end)) ||
                          (kind === "freeze_end" && (!freeze || !validDate(end)))
                        ) {
                          setError("VALIDATION_FAILED");
                          return;
                        }
                        lock.current = true;
                        setBusy(true);
                        setError("");
                        try {
                          const next =
                            kind === "freeze"
                              ? await api.freeze(scope, sale.sale_id, start, end, reason.trim())
                              : kind === "freeze_end"
                                ? await api.end(scope, freezeId, end, reason.trim())
                                : await api.terminate(scope, sale.sale_id, reason.trim());
                          if (!lifecycleMatches(next, sale.sale_id))
                            throw Error("invalidLifecycle");
                          if (lifetime.current) setPreview(next);
                        } catch (cause) {
                          if (lifetime.current) setError(flowError(cause));
                        } finally {
                          lock.current = false;
                          if (lifetime.current) setBusy(false);
                        }
                      }}
                    >
                      <fieldset disabled={disabled} className="space-y-4">
                        <legend className="sr-only">{t(kind)}</legend>
                        {kind === "freeze" && (
                          <DateField
                            id={`${id}-start`}
                            label={t("start")}
                            value={start}
                            onChange={setStart}
                          />
                        )}
                        {kind === "freeze_end" && (
                          <label htmlFor={`${id}-freeze`} className="block space-y-2 text-sm">
                            <span>{t("freezeSource")}</span>
                            <select
                              id={`${id}-freeze`}
                              required
                              value={freezeId}
                              onChange={(e) => setFreezeId(e.target.value)}
                              className="min-h-11 w-full rounded-md border bg-background px-3"
                            >
                              <option value="">{t("choose")}</option>
                              {freezes.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {formatDate.dateTime(new Date(f.starts_at), {
                                    timeZone: sale.timezone,
                                    dateStyle: "medium",
                                  })}{" "}
                                  —{" "}
                                  {formatDate.dateTime(new Date(f.planned_end), {
                                    timeZone: sale.timezone,
                                    dateStyle: "medium",
                                  })}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        {kind !== "terminate" && (
                          <DateField
                            id={`${id}-end`}
                            label={t("end")}
                            value={end}
                            onChange={setEnd}
                          />
                        )}
                        <label htmlFor={`${id}-reason`} className="block space-y-2 text-sm">
                          <span>{t("reason")}</span>
                          <Input
                            id={`${id}-reason`}
                            required
                            maxLength={10000}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                        <Button type="submit">{t("preview")}</Button>
                      </fieldset>
                    </form>
                  )}
                  {kind && preview && (
                    <FinancePreviewReview
                      key={preview.id}
                      timeZone={sale.timezone}
                      preview={preview}
                      disabled={disabled}
                      onBack={() => setPreview(null)}
                      onApply={() => void command.run(lifecycleCommand(scope, kind, preview))}
                    >
                      <p>{t(kind)}</p>
                      <p>{sale.timezone}</p>
                      {kind === "freeze" && <p>{t("requestedDates", { start, end })}</p>}
                      {kind === "freeze_end" && (
                        <>
                          <p>{t("requestedEnd", { end })}</p>
                          {freezes
                            .filter((f) => f.id === freezeId)
                            .map((f) => (
                              <p key={f.id}>
                                {t("selectedFreeze", {
                                  start: formatDate.dateTime(new Date(f.starts_at), {
                                    timeZone: sale.timezone,
                                    dateStyle: "medium",
                                  }),
                                  end: formatDate.dateTime(new Date(f.planned_end), {
                                    timeZone: sale.timezone,
                                    dateStyle: "medium",
                                  }),
                                })}
                              </p>
                            ))}
                        </>
                      )}
                      <p>{t("sourceDates", { start: sale.start_date, end: sale.end_date })}</p>
                      <p className="text-sm">
                        {t(kind === "terminate" ? "terminationHint" : "protectionHint")}
                      </p>
                    </FinancePreviewReview>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {error && <FlowError code={error} />}
    </section>
  );
}
function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm">
      <span>{label}</span>
      <Input
        id={id}
        type="date"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
