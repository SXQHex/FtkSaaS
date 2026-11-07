"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProductView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { listProducts, productDisciplines } from "../../lib/products";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ProductSummary } from "./product-summary";
import { ProductPublication } from "./product-publication";
const NegativeValuation = dynamic(() =>
  import("./negative-valuation").then((m) => m.NegativeValuation),
);
type Reads = { list?: typeof listProducts; disciplines?: typeof productDisciplines };
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
export function ProductManager({ scope, ...reads }: { scope: SetupScope } & Reads) {
  return <ProductConnection key={JSON.stringify(scope)} scope={scope} {...reads} />;
}
function ProductConnection({ scope, ...reads }: { scope: SetupScope } & Reads) {
  const [revision, setRevision] = useState(0);
  const command = useSetupCommand(scope, "product-publish", () => setRevision((n) => n + 1));
  return <ProductCatalog key={revision} scope={scope} command={command} {...reads} />;
}
export function ProductCatalog({
  scope,
  command,
  list = listProducts,
  disciplines = productDisciplines,
}: { scope: SetupScope; command: ReturnType<typeof useSetupCommand> } & Reads) {
  const t = useTranslations("products"),
    heading = useRef<HTMLHeadingElement>(null);
  const [valuation, setValuation] = useState(false);
  const [page, setPage] = useState<Awaited<ReturnType<typeof listProducts>> | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [cursor, setCursor] = useState<string>(),
    [form, setForm] = useState<{ product?: ProductView } | null>(null);
  useEffect(() => {
    let active = true;
    void list(scope, cursor)
      .then((result) => {
        if (active) setPage(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, list, cursor, retry]);
  useEffect(() => {
    if (command.message === "saved" || command.message === "failed") heading.current?.focus();
  }, [command.message]);
  const disabled = command.busy || !!command.pending;
  return (
    <section aria-label={t("title")} className="min-w-0 space-y-5 wrap-anywhere">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
          {t("title")}
        </h2>
        <Button className={buttonClass} disabled={disabled} onClick={() => setForm({})}>
          {t("newProduct")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("catalogHint")}</p>
      <SetupFeedback command={command} />
      <Button
        className={buttonClass}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={valuation}
        onClick={() => setValuation((v) => !v)}
      >
        {t("valuation")}
      </Button>
      {valuation && <NegativeValuation scope={scope} />}
      {form && (
        <>
          <ProductPublication
            key={form.product?.id ?? "new"}
            scope={scope}
            product={form.product}
            command={command}
            read={disciplines}
          />
          <Button
            className={buttonClass}
            variant="outline"
            disabled={command.busy}
            onClick={() => {
              setForm(null);
              heading.current?.focus();
            }}
          >
            {t("closePublication")}
          </Button>
        </>
      )}
      {error ? (
        <p role="alert">{t("catalogError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : !page.items.length ? (
        <p>{t("emptyCatalog")}</p>
      ) : (
        <ul className="space-y-4">
          {page.items.map((product) => (
            <li key={product.id} className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
              <h3 className="break-words font-semibold">{product.terms.name}</h3>
              <ProductSummary terms={product.terms} />
              <Button
                className={buttonClass}
                variant="outline"
                disabled={disabled}
                onClick={() => setForm({ product })}
              >
                {t("publishVersion", { name: product.terms.name })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-3">
        {page?.next_cursor && (
          <Button
            className={buttonClass}
            variant="outline"
            disabled={command.busy}
            onClick={() => {
              setForm(null);
              setPage(null);
              setError(false);
              setCursor(page.next_cursor ?? undefined);
            }}
          >
            {t("next")}
          </Button>
        )}
        <Button
          className={buttonClass}
          variant="outline"
          disabled={command.busy}
          onClick={() => {
            setForm(null);
            setPage(null);
            setError(false);
            setCursor(undefined);
            setRetry((n) => n + 1);
          }}
        >
          {t("reload")}
        </Button>
      </div>
    </section>
  );
}
