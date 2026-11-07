"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { ProductTerms, ProductView, DisciplineView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { productDisciplines } from "../../lib/products";
import { productTerms, validPublishedTerms, type ProductDraft } from "../../lib/product-terms";
import type { SetupScope } from "../../lib/studio-setup";
import type { useSetupCommand } from "../setup/setup-command";
import dynamic from "next/dynamic";
import { ProductSummary } from "./product-summary";
const ProProductFields = dynamic(() =>
  import("./pro-product-fields").then((m) => m.ProProductFields),
);
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
export function ProductPublication({
  scope,
  product,
  command,
  read = productDisciplines,
}: {
  scope: SetupScope;
  product?: ProductView;
  command: ReturnType<typeof useSetupCommand>;
  read?: typeof productDisciplines;
}) {
  const t = useTranslations("products");
  const [rows, setRows] = useState<DisciplineView[] | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void read(scope)
      .then((result) => {
        if (active) setRows(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, read, attempt]);
  const unsupported = product && !validPublishedTerms(product.terms, scope.centerId ?? "");
  return (
    <div className="space-y-4">
      {unsupported ? (
        <p>{t("unsupportedVersion")}</p>
      ) : error ? (
        <p role="alert">{t("disciplinesError")}</p>
      ) : !rows ? (
        <output>{t("loading")}</output>
      ) : !rows.length ? (
        <p>{t("noDiscipline")}</p>
      ) : (
        <ProductPublicationForm
          scope={scope}
          product={product}
          disciplines={rows}
          command={command}
        />
      )}
      {error && (
        <Button
          className={buttonClass}
          variant="outline"
          onClick={() => {
            setError(false);
            setRows(null);
            setAttempt((n) => n + 1);
          }}
        >
          {t("reload")}
        </Button>
      )}
    </div>
  );
}
export function ProductPublicationForm({
  scope,
  product,
  disciplines,
  command,
}: {
  scope: SetupScope;
  product?: ProductView;
  disciplines: DisciplineView[];
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("products"),
    id = useId();
  const [advanced, setAdvanced] = useState(
    !!product &&
      (product.terms.freeze.enabled ||
        product.terms.scopes.length !== 1 ||
        product.terms.scopes[0].scope_kind !== "center_discipline" ||
        product.terms.scopes[0].usage_targets.some((t) => t !== "lesson") ||
        !!product.terms.scopes[0].class_id ||
        !!product.terms.scopes[0].event_id),
  );
  const [proReady, setProReady] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>({
    name: product?.terms.name ?? "",
    disciplineId:
      product?.terms.scopes[0]?.scope_kind === "center_discipline"
        ? product.terms.scopes[0].discipline_id
        : "",
    kind: "credits",
    bookingMode: "flexible",
    credits: "",
    price: "",
    currency: "",
    quotaPeriod: "month",
    quotaLimit: "",
    refund: "none",
    usedUnitPrice: "",
    ...(product ? { scopes: product.terms.scopes, freeze: product.terms.freeze } : {}),
  });
  const [approval, setApproval] = useState<ProductTerms | null>(null),
    [invalid, setInvalid] = useState(false);
  const confirm = useRef<HTMLButtonElement>(null),
    review = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const commandLocked = command.busy || !!command.pending;
  const proTerms =
    !!draft.freeze?.enabled ||
    !!draft.scopes?.some(
      (s) =>
        s.scope_kind !== "center_discipline" ||
        s.usage_targets.some((target) => target !== "lesson") ||
        !!s.class_id ||
        !!s.event_id,
    ) ||
    (draft.scopes?.length ?? 0) > 1;
  const disabled = commandLocked || ((advanced || proTerms) && !proReady);
  useEffect(() => {
    if (approval) confirm.current?.focus();
  }, [approval]);
  function update<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((old) => ({
      ...old,
      [key]: value,
      ...(key === "kind" && value !== "credits" && old.refund === "credit_ratio"
        ? { refund: "none" as const }
        : {}),
    }));
    setApproval(null);
    setInvalid(false);
  }
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const discipline = disciplines.find((row) => row.id === draft.disciplineId);
    try {
      if (
        (!discipline && !draft.scopes) ||
        !scope.centerId ||
        ((advanced || proTerms) && !proReady)
      )
        throw Error("invalidProduct");
      const terms = productTerms(draft, discipline, scope.centerId);
      setApproval(product ? { ...terms, name: product.terms.name } : terms);
      setInvalid(false);
    } catch {
      setApproval(null);
      setInvalid(true);
    }
  }
  return (
    <section
      aria-label={t("publication")}
      className="min-w-0 space-y-5 rounded-xl border p-4 wrap-anywhere"
    >
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t(product ? "newVersion" : "newProduct")}
      </h3>
      {product && <p className="text-sm">{t("versionTarget", { name: product.terms.name })}</p>}
      <p className="text-sm text-muted-foreground">{t("publicationHint")}</p>
      <Button
        className={buttonClass}
        type="button"
        variant="outline"
        disabled={commandLocked}
        aria-expanded={advanced}
        onClick={() => {
          setAdvanced((v) => !v);
          setApproval(null);
        }}
      >
        {t("advancedTerms")}
      </Button>
      {advanced && (
        <ProProductFields
          scope={scope}
          draft={draft}
          disciplines={disciplines}
          disabled={commandLocked}
          onReady={setProReady}
          onChange={(next) => {
            setDraft(next);
            setApproval(null);
            setInvalid(false);
          }}
        />
      )}
      {!((advanced || proTerms) && !proReady) && (
        <form className="space-y-4" onSubmit={prepare}>
          <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className="sr-only">{t("publication")}</legend>
            <div className="space-y-2">
              <Label htmlFor={`${id}-discipline`}>{t("discipline")}</Label>
              <select
                id={`${id}-discipline`}
                disabled={!!product || !!draft.scopes}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                required={!draft.scopes}
                value={draft.disciplineId}
                onChange={(e) => update("disciplineId", e.target.value)}
              >
                <option value="">{t("chooseDiscipline")}</option>
                {disciplines.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>{t(product ? "existingName" : "name")}</Label>
              <Input
                id={`${id}-name`}
                readOnly={!!product}
                required
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t(product ? "preservedNameHint" : "nameHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-kind`}>{t("kind")}</Label>
              <select
                id={`${id}-kind`}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.kind}
                onChange={(e) =>
                  update(
                    "kind",
                    e.target.value === "quota"
                      ? "quota"
                      : e.target.value === "unlimited"
                        ? "unlimited"
                        : "credits",
                  )
                }
              >
                <option value="credits">{t("creditsKind")}</option>
                <option value="quota">{t("quotaKind")}</option>
                <option value="unlimited">{t("unlimitedKind")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-booking`}>{t("bookingMode")}</Label>
              <select
                id={`${id}-booking`}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.bookingMode}
                onChange={(e) =>
                  update("bookingMode", e.target.value === "priority" ? "priority" : "flexible")
                }
              >
                <option value="flexible">{t("flexible")}</option>
                <option value="priority">{t("priority")}</option>
              </select>
            </div>
            {draft.kind === "credits" && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-credits`}>{t("credits")}</Label>
                <Input
                  id={`${id}-credits`}
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft.credits}
                  onChange={(e) => update("credits", e.target.value)}
                />
              </div>
            )}
            {draft.kind === "quota" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-period`}>{t("quotaPeriod")}</Label>
                  <select
                    id={`${id}-period`}
                    className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.quotaPeriod}
                    onChange={(e) =>
                      update("quotaPeriod", e.target.value === "week" ? "week" : "month")
                    }
                  >
                    <option value="week">{t("week")}</option>
                    <option value="month">{t("month")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-limit`}>{t("quota")}</Label>
                  <Input
                    id={`${id}-limit`}
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={draft.quotaLimit}
                    onChange={(e) => update("quotaLimit", e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${id}-currency`}>{t("currency")}</Label>
              <Input
                id={`${id}-currency`}
                required
                minLength={3}
                maxLength={3}
                pattern="[A-Z]{3}"
                placeholder="TRY"
                value={draft.currency}
                onChange={(e) => update("currency", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-price`}>{t("price")}</Label>
              <Input
                id={`${id}-price`}
                inputMode="decimal"
                required
                value={draft.price}
                onChange={(e) => update("price", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-refund`}>{t("refund")}</Label>
              <select
                id={`${id}-refund`}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.refund}
                onChange={(e) =>
                  update(
                    "refund",
                    e.target.value === "credit_ratio"
                      ? "credit_ratio"
                      : e.target.value === "time_ratio"
                        ? "time_ratio"
                        : e.target.value === "used_at_unit_price"
                          ? "used_at_unit_price"
                          : "none",
                  )
                }
              >
                {[
                  "none",
                  ...(draft.kind === "credits" ? ["credit_ratio"] : []),
                  "time_ratio",
                  "used_at_unit_price",
                ].map((method) => (
                  <option key={method} value={method}>
                    {t(`refunds.${method}`)}
                  </option>
                ))}
              </select>
            </div>
            {draft.refund === "used_at_unit_price" && (
              <div className="space-y-2">
                <Label htmlFor={`${id}-unit`}>{t("usedUnitPrice")}</Label>
                <Input
                  id={`${id}-unit`}
                  inputMode="decimal"
                  required
                  value={draft.usedUnitPrice}
                  onChange={(e) => update("usedUnitPrice", e.target.value)}
                />
              </div>
            )}
          </fieldset>
          {invalid && <p role="alert">{t("invalidProduct")}</p>}
          <Button
            ref={review}
            className={buttonClass}
            variant="outline"
            disabled={disabled}
            type="submit"
          >
            {t("review")}
          </Button>
        </form>
      )}
      {!advanced && proTerms && !proReady && <p role="alert">{t("unsupportedVersion")}</p>}
      {approval && (
        <div className="space-y-4 border-t pt-4">
          <h4 className="break-words font-semibold">{approval.name}</h4>
          <ProductSummary terms={approval} />
          <p className="text-sm">{t("confirmHint")}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              ref={confirm}
              className={buttonClass}
              disabled={disabled}
              onClick={() => {
                const terms = approval;
                setApproval(null);
                heading.current?.focus();
                void command.run({
                  operation: "product_publish_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    ...(product ? { product_id: product.id } : {}),
                    terms,
                    operation_key: v7(),
                  },
                });
              }}
            >
              {t("publish")}
            </Button>
            <Button
              className={buttonClass}
              variant="outline"
              disabled={command.busy}
              onClick={() => {
                setApproval(null);
                requestAnimationFrame(() => review.current?.focus());
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
