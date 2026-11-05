"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { EntitlementView, FinanceView, Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { salesApi, renewalMatches, type RenewalInput, type SalesApi } from "../../lib/sales";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { FlowError, flowError } from "../bookings/flow-controls";
import { ContextDocuments } from "../documents/context-documents";
import { effectMoney } from "../../lib/effect-money";
import { ProductSummary } from "./product-summary";
import { SaleReview } from "./sale-review";
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
      <p>{t("saleBlocked")}</p>
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
        <RenewalForm
          key={revision}
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
export function RenewalForm({
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
    [review, setReview] = useState<{ input: RenewalInput; preview: Preview } | null>(null),
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
    void Promise.all([api.products(scope, cursor), api.rights(scope, personId)])
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
  }, [scope, personId, api, cursor, attempt]);
  const disabled = busy || command.busy || !!command.pending,
    product = page?.items.find((row) => row.version_id === productId);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || lock.current || !product || !rights?.some((row) => row.sale_id === previous))
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
      const input = {
        previous_sale_id: previous,
        product_version_id: productId,
        start_date: start,
        end_date: end,
      };
      const preview = await api.preview(scope, input);
      if (!renewalMatches(preview, input)) throw Error("invalidPreview");
      if (alive.current) setReview({ input, preview });
    } catch (cause) {
      if (alive.current) setError(flowError(cause));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4">
      <h4 className="font-semibold">{t("renewal")}</h4>
      <p>{t("renewalHint")}</p>
      {error && <FlowError code={error} />}
      {(!page || !rights) && !error && <output>{t("loading")}</output>}
      {page && rights && (
        <form
          className="space-y-4"
          onSubmit={(event) => void submit(event)}
          onChange={() => setReview(null)}
        >
          <fieldset disabled={disabled} className="min-w-0 space-y-3">
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
              disabled={!product || !previous}
            >
              {t("inspectRenewal")}
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
            onClick={() => setDocs((value) => !value)}
          >
            {t("documents")}
          </Button>
          {docs && (
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
          )}
        </>
      )}
      {review && (
        <SaleReview
          preview={review.preview}
          disabled={disabled}
          onBack={() => {
            setReview(null);
            inspect.current?.focus();
          }}
          onApply={() => {
            if (disabled || !product || !renewalMatches(review.preview, review.input)) return;
            onCurrency?.(product.terms.currency);
            void command
              .run({
                operation: "sale_renew_apply_v1",
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
