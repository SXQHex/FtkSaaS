"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useDisplayMoney } from "../display-format";
import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { saleDocumentPath } from "../../lib/sale-document-route";
import { v7 } from "uuid";
import type { Preview, EntitlementView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { setupCall, type SetupScope } from "../../lib/studio-setup";
import { readEntitlements, listProducts } from "../../lib/products";
import { readChangeInventory, partitionChange } from "../../lib/sale-change";
import { lifecycleMatches } from "../../lib/sale-lifecycle-command";
import { useRemote } from "../../lib/use-remote";
import { FlowError, flowError } from "../bookings/flow-controls";
import { FinancePreviewReview } from "../finance/finance-preview-review";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
const control = "min-h-11 w-full rounded-md border bg-background px-3",
  button = "h-auto min-h-11 max-w-full whitespace-normal";
export function SaleChange({
  scope,
  personId,
  onSaved,
}: {
  scope: SetupScope;
  personId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("saleChange"),
    [open, setOpen] = useState(false),
    [revision, setRevision] = useState(0);
  const load = useCallback(() => readEntitlements(scope, personId), [scope, personId]),
    result = useRemote(load, JSON.stringify([scope, personId, revision]));
  const [saleId, setSaleId] = useState("");
  const sale = result?.data?.find(
    (r) => r.sale_id === saleId && r.person_id === personId && r.sale_state === "active",
  );
  return (
    <section className="space-y-4 border-t pt-4" aria-label={t("title")}>
      <Button
        className={button}
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("title")}
      </Button>
      {open && (
        <>
          {result?.error && <FlowError code={result.error} />}
          <label>
            {t("source")}
            <select className={control} value={saleId} onChange={(e) => setSaleId(e.target.value)}>
              <option value="">{t("choose")}</option>
              {result?.data
                ?.filter((r) => r.person_id === personId && r.sale_state === "active")
                .map((r, i) => (
                  <option key={r.sale_id} value={r.sale_id}>
                    {t("sale", { number: i + 1 })} · {r.start_date}–{r.end_date}
                  </option>
                ))}
            </select>
          </label>
          {sale && (
            <ChangeForm
              key={`${sale.sale_id}:${revision}`}
              scope={scope}
              personId={personId}
              sale={sale}
              onSaved={() => {
                setSaleId("");
                setRevision((n) => n + 1);
                onSaved();
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function ChangeForm({
  scope,
  personId,
  sale,
  onSaved,
}: {
  scope: SetupScope;
  personId: string;
  sale: EntitlementView;
  onSaved: () => void;
}) {
  const effectMoney = useDisplayMoney();

  const t = useTranslations("saleChange"),
    format = useFormatter(),
    locale = useLocale(),
    [revision, setRevision] = useState(0),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [target, setTarget] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    const inventory = await readChangeInventory(scope, sale.sale_id, personId),
      products = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const p = await listProducts(scope, cursor);
      products.push(...p.items);
      cursor = p.next_cursor ?? undefined;
      if (cursor && seen.has(cursor)) throw Error("invalidSaleChange");
      if (cursor) seen.add(cursor);
    } while (cursor);
    return { inventory, products };
  }, [scope, sale.sale_id, personId]);
  const result = useRemote(load, JSON.stringify([scope, sale.sale_id, revision])),
    command = useSetupCommand(scope, `sale-change:${personId}`, onSaved, () => {
      setPreview(null);
      setChoices({});
      setRevision((n) => n + 1);
    });
  const dirty = () => {
    setPreview(null);
    setError("");
  };
  const events =
    result?.data?.inventory.records.filter((r) => r.kind === "event_registrations") ?? [];
  return (
    <div className="space-y-4">
      <SetupFeedback command={command} />
      <Button
        className={button}
        variant="outline"
        disabled={busy || command.busy}
        onClick={() => {
          dirty();
          setChoices({});
          setRevision((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />} {error && <FlowError code={error} />}{" "}
      {result?.data && (
        <>
          {events.length > 0 && <p role="alert">{t("eventBlock")} </p>}
          {events.map((r, i) => (
            <p key={r.id}>
              <a
                className="underline"
                href={`/?org=${scope.orgId}&center=${r.center_id}&event=${r.parent.id}&eventDate=${r.starts_at.slice(0, 10)}#events`}
              >
                {t("linkedEvent", { number: i + 1 })} ·{" "}
                {format.dateTime(new Date(r.starts_at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: sale.timezone,
                })}
              </a>
            </p>
          ))}
          <form
            className="space-y-4"
            onChange={dirty}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || command.pending || !result.data || events.length) return;
              setBusy(true);
              setError("");
              try {
                const partition = partitionChange(result.data.inventory, choices);
                if (!result.data.products.some((p) => p.version_id === target))
                  throw Error("invalidSaleChange");
                const p = await setupCall("sale_change_preview_v1", {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  sale_id: sale.sale_id,
                  new_product_version_id: target,
                  start_date: start,
                  end_date: end,
                  reason: reason.trim(),
                  ...partition,
                });
                const d = p.sale_lifecycle;
                if (
                  !lifecycleMatches(p, sale.sale_id) ||
                  !d ||
                  !d.refund ||
                  d.previous_sale_id !== sale.sale_id ||
                  d.product_version_id !== target ||
                  d.start_date !== start ||
                  d.end_date !== end ||
                  !p.dependencies.versions.some(
                    (v) =>
                      v.entity.type === "sales" &&
                      v.entity.id === sale.sale_id &&
                      v.version === result.data!.inventory.source.version,
                  )
                )
                  throw Error("invalidSaleChange");
                setPreview(p);
              } catch (c) {
                setError(flowError(c));
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset
              disabled={busy || command.busy || !!command.pending || !!events.length}
              className="space-y-4"
            >
              {result.data.inventory.records.map((r, i) => (
                <label className="block" key={r.id}>
                  {t("reservation", { number: i + 1 })} ·{" "}
                  {format.dateTime(new Date(r.starts_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: sale.timezone,
                  })}
                  <select
                    required
                    className={control}
                    value={choices[r.id] ?? ""}
                    onChange={(e) => setChoices((s) => ({ ...s, [r.id]: e.target.value }))}
                  >
                    <option value="">{t("choose")}</option>
                    <option value="keep">{t("keep")}</option>
                    <option value="cancel">{t("cancel")}</option>
                  </select>
                </label>
              ))}
              <label className="block">
                {t("target")}
                <select
                  className={control}
                  required
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">{t("choose")}</option>
                  {result.data.products.map((p) => (
                    <option key={p.version_id} value={p.version_id}>
                      {p.terms.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                {t("start")}
                <Input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="block">
                {t("end")}
                <Input
                  type="date"
                  required
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label className="block">
                {t("reason")}
                <Input
                  required
                  maxLength={10000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {target && scope.centerId && (
                <a
                  className="block underline"
                  href={saleDocumentPath(scope.orgId, scope.centerId, target)}
                >
                  {t("documents")}
                </a>
              )}
              <Button className={button}>{t("review")}</Button>
            </fieldset>
          </form>
          {preview && (
            <FinancePreviewReview
              key={preview.id}
              preview={preview}
              timeZone={sale.timezone}
              disabled={busy || command.busy || !!command.pending}
              onBack={dirty}
              onApply={() => {
                if (!lifecycleMatches(preview, sale.sale_id)) return setError("PREVIEW_STALE");
                void command.run({
                  operation: "sale_change_apply_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    preview: { id: preview.id, token: preview.token },
                  },
                });
              }}
            >
              <p>{t("effectHint")}</p>
              {preview.sale_lifecycle?.refund && (
                <dl className="space-y-2">
                  <dt>{t("refundTotal")}</dt>
                  <dd>
                    {effectMoney(
                      preview.sale_lifecycle.refund.calculated_minor,
                      preview.sale_lifecycle.refund.currency,
                      locale,
                    )}
                  </dd>
                  <dt>{t("debtReduction")}</dt>
                  <dd>
                    {effectMoney(
                      preview.sale_lifecycle.refund.debt_reduction_minor,
                      preview.sale_lifecycle.refund.currency,
                      locale,
                    )}
                  </dd>
                  <dt>{t("creditAdded")}</dt>
                  <dd>
                    {effectMoney(
                      preview.sale_lifecycle.refund.credit_added_minor,
                      preview.sale_lifecycle.refund.currency,
                      locale,
                    )}
                  </dd>
                  <dt>{t("offset")}</dt>
                  <dd>
                    {effectMoney(
                      preview.sale_lifecycle.offset_minor,
                      preview.sale_lifecycle.refund.currency,
                      locale,
                    )}
                  </dd>
                  <dt>{t("gapOverlap")}</dt>
                  <dd>
                    {preview.sale_lifecycle.gap_days} / {preview.sale_lifecycle.overlap_days}
                  </dd>
                </dl>
              )}
              <p>
                {result.data.products.find((p) => p.version_id === target)?.terms.name} · {start}–
                {end}
              </p>
            </FinancePreviewReview>
          )}
        </>
      )}
    </div>
  );
}
