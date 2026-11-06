"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { saleDocumentPath } from "../../lib/sale-document-route";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { EntitlementView, Preview, SalePreview, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  saleMatches,
  renewalMatches,
  type SaleInput,
  type RenewalInput,
  type SalesApi,
} from "../../lib/sales";
import { ApiFailure } from "../../lib/api";
import type { SetupScope } from "../../lib/studio-setup";
import type { useSetupCommand } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { ContextDocuments } from "../documents/context-documents";
import { ProductSummary } from "./product-summary";
import { SaleReview } from "./sale-review";
type PurchaseReview =
  | { kind: "renew"; input: RenewalInput; preview: Preview }
  | { kind: "sale"; input: SaleInput; preview: SalePreview; sessions: SessionView[] };
export function SaleForm({
  mode = "renew",
  scope,
  personId,
  api,
  command,
  onCurrency,
}: {
  scope: SetupScope;
  personId: string;
  api: SalesApi;
  command: ReturnType<typeof useSetupCommand>;
  onCurrency?: (value: string) => void;
  mode?: "sale" | "renew";
}) {
  const t = useTranslations("flows"),
    id = useId(),
    [page, setPage] = useState<Awaited<ReturnType<SalesApi["products"]>> | null>(null),
    [rights, setRights] = useState<EntitlementView[] | null>(null),
    [error, setError] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [productId, setProductId] = useState(""),
    [previous, setPrevious] = useState(""),
    [review, setReview] = useState<PurchaseReview | null>(null),
    [busy, setBusy] = useState(false),
    [docs, setDocs] = useState(false),
    alive = useRef(true),
    lock = useRef(false),
    inspect = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.products(scope, cursor),
      mode === "renew" ? api.rights(scope, personId) : Promise.resolve([]),
    ])
      .then(([products, rows]) => {
        if (rows.some((row) => row.person_id !== personId)) throw Error("invalidForm");
        if (active) {
          setPage(products);
          setRights(rows);
        }
      })
      .catch((cause) => {
        if (active) setError(flowError(cause));
      });
    return () => {
      active = false;
    };
  }, [scope, personId, api, cursor, attempt, mode]);
  const disabled = busy || command.busy || !!command.pending,
    product = page?.items.find((row) => row.version_id === productId);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      disabled ||
      lock.current ||
      !product ||
      (mode === "renew" && !rights?.some((row) => row.sale_id === previous))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setReview(null);
    try {
      const data = new FormData(event.currentTarget),
        start = String(data.get("start")),
        end = String(data.get("end"));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end)
        throw Error("invalidForm");
      const dates = {
        product_version_id: productId,
        start_date: start,
        end_date: end,
      };
      if (mode === "renew") {
        const input = { ...dates, previous_sale_id: previous };
        const preview = await api.preview(scope, input);
        if (!renewalMatches(preview, input)) throw Error("invalidPreview");
        if (alive.current) setReview({ kind: "renew", input, preview });
      } else {
        const input = { ...dates, person_id: personId };
        const preview = await api.salePreview(scope, input);
        if (!saleMatches(preview, input)) throw Error("invalidPreview");
        const sessions = await Promise.all(
          [...new Set(preview.sale.deficits.map((row) => row.session_id))].map((id) =>
            api
              .session(scope.orgId, scope.centerId, id)
              .then((session) => {
                if (session.id !== id) throw Error("invalidPreview");
                return session;
              })
              .catch((cause) => {
                if (cause instanceof ApiFailure && cause.failure.error.code === "FORBIDDEN")
                  return null;
                throw cause;
              }),
          ),
        );
        const readable = sessions.filter((session): session is SessionView => session !== null);
        if (
          preview.sale.deficits.some((row) =>
            readable.some(
              (session) => session.id === row.session_id && session.version !== row.session_version,
            ),
          )
        )
          throw Error("PREVIEW_STALE");
        if (alive.current) setReview({ kind: "sale", input, preview, sessions: readable });
      }
    } catch (cause) {
      if (alive.current) setError(flowError(cause));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <h4 className="font-semibold">{t(mode === "sale" ? "newSale" : "renewal")}</h4>
      <p>{t(mode === "sale" ? "saleHint" : "renewalHint")}</p>
      {error && <FlowError code={error} />}
      {(!page || !rights) && !error && <output>{t("loading")}</output>}
      {page && rights && (
        <form
          className="space-y-4"
          onSubmit={(event) => void submit(event)}
          onChange={() => setReview(null)}
        >
          <fieldset disabled={disabled} className="min-w-0 space-y-3">
            {mode === "renew" && (
              <>
                <Label htmlFor={`${id}-previous`}>{t("previousSale")}</Label>
                <select
                  id={`${id}-previous`}
                  required
                  value={previous}
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                  onChange={(event) => setPrevious(event.target.value)}
                >
                  <option value="">{t("choose")}</option>
                  {rights.map((row, i) => (
                    <option key={row.sale_id} value={row.sale_id}>
                      {i + 1} · {row.start_date} — {row.end_date}
                    </option>
                  ))}
                </select>
                {!rights.length && <p>{t("noSales")}</p>}
              </>
            )}
            <Label htmlFor={`${id}-product`}>{t("product")}</Label>
            <select
              id={`${id}-product`}
              required
              value={productId}
              className="min-h-11 w-full rounded-md border bg-background px-3"
              onChange={(event) => {
                setProductId(event.target.value);
                setDocs(false);
              }}
            >
              <option value="">{t("choose")}</option>
              {page.items.map((row) => (
                <option key={row.version_id} value={row.version_id}>
                  {row.terms.name}
                </option>
              ))}
            </select>
            {product && <ProductSummary terms={product.terms} />}
            <Label htmlFor={`${id}-start`}>{t("startDate")}</Label>
            <Input id={`${id}-start`} type="date" name="start" required />
            <Label htmlFor={`${id}-end`}>{t("endDate")}</Label>
            <Input id={`${id}-end`} type="date" name="end" required />
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              ref={inspect}
              disabled={!product || (mode === "renew" && !previous)}
            >
              {t(mode === "sale" ? "inspectSale" : "inspectRenewal")}
            </Button>
          </fieldset>
        </form>
      )}
      {page?.next_cursor && (
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            setPage(null);
            setReview(null);
            setProductId("");
            setCursor(page.next_cursor ?? undefined);
          }}
        >
          {t("next")}
        </Button>
      )}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setPage(null);
          setRights(null);
          setReview(null);
          setError("");
          setProductId("");
          setPrevious("");
          setCursor(undefined);
          setAttempt((n) => n + 1);
        }}
      >
        {t("reload")}
      </Button>
      {product && (
        <>
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            variant="outline"
            aria-expanded={docs}
            onClick={() => {
              setReview(null);
              setDocs((value) => !value);
            }}
          >
            {t("documents")}
          </Button>
          {docs && (
            <div className="space-y-4">
              {scope.centerId && (
                <div className="space-y-2">
                  <Button
                    asChild
                    variant="outline"
                    className="h-auto min-h-11 max-w-full whitespace-normal"
                  >
                    <Link
                      prefetch={false}
                      href={saleDocumentPath(scope.orgId, scope.centerId, product.version_id)}
                    >
                      {t("selfDocumentsLink")}
                    </Link>
                  </Button>
                  <p className="text-sm text-muted-foreground">{t("selfDocumentsLinkHint")}</p>
                </div>
              )}
              <ContextDocuments
                actorId={scope.actorId}
                actions={api.documents}
                query={{
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  person_id: personId,
                  context: {
                    gate: "sale",
                    subject: { type: "product_versions", id: product.version_id },
                    product_version_id: product.version_id,
                  },
                }}
              />
            </div>
          )}
        </>
      )}
      {review && (
        <SaleReview
          key={review.preview.id}
          preview={review.preview}
          sessions={review.kind === "sale" ? review.sessions : undefined}
          disabled={disabled}
          onBack={() => {
            setReview(null);
            inspect.current?.focus();
          }}
          onApply={() => {
            if (disabled || !product) return;
            if (
              review.kind === "renew"
                ? !renewalMatches(review.preview, review.input)
                : !saleMatches(review.preview, review.input)
            )
              return;
            onCurrency?.(
              review.kind === "sale" ? review.preview.sale.currency : product.terms.currency,
            );
            void command
              .run({
                operation: review.kind === "sale" ? "sale_apply_v1" : "sale_renew_apply_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  preview: { id: review.preview.id, token: review.preview.token },
                },
              })
              .then(() => {
                if (alive.current) {
                  setReview(null);
                  inspect.current?.focus();
                }
              });
          }}
        />
      )}
    </div>
  );
}
