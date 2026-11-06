"use client";
import { useId, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { PayDraft } from "../../lib/agreement-command";
import { emptyComponent } from "../../lib/agreement-command";
import type { AgreementApi } from "../../lib/agreements";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
import { PayComponents, BasisFields } from "./pay-component-fields";
export function PayTermsFields({
  value,
  onChange,
  scope,
  api,
}: {
  value: PayDraft;
  onChange: (value: PayDraft) => void;
  scope: SetupScope;
  api: AgreementApi;
}) {
  const t = useTranslations("agreements"),
    id = useId(),
    [productsOpen, setProductsOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Label htmlFor={`${id}-model`}>{t("model")}</Label>
      <select
        id={`${id}-model`}
        required
        className="min-h-11 w-full rounded-md border bg-background px-3"
        value={value.model}
        onChange={(event) => onChange({ ...value, model: event.target.value })}
      >
        <option value="">{t("choose")}</option>
        {["percentage", "session_fixed", "per_person", "fixed_plus_person", "explicit_mixed"].map(
          (model) => (
            <option key={model} value={model}>
              {t(`models.${model}`)}
            </option>
          ),
        )}
      </select>
      <Label htmlFor={`${id}-currency`}>{t("currency")}</Label>
      <Input
        id={`${id}-currency`}
        required
        maxLength={3}
        pattern="[A-Za-z]{3}"
        value={value.currency}
        onChange={(event) => onChange({ ...value, currency: event.target.value.toUpperCase() })}
      />
      <PayComponents
        value={value.components}
        onChange={(components) => onChange({ ...value, components })}
      />
      <fieldset className="space-y-3 rounded-md border p-3">
        <legend>{t("roomFee")}</legend>
        <Label htmlFor={`${id}-room`}>{t("roomKind")}</Label>
        <select
          id={`${id}-room`}
          required
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={value.room.kind}
          onChange={(event) =>
            onChange({
              ...value,
              room: {
                ...value.room,
                kind: event.target.value,
                amount: "",
                rate: "",
                basis: "",
                unit: "",
              },
            })
          }
        >
          <option value="">{t("choose")}</option>
          {["free", "fixed", "percentage"].map((kind) => (
            <option key={kind} value={kind}>
              {t(`roomKinds.${kind}`)}
            </option>
          ))}
        </select>
        {value.room.kind === "fixed" && (
          <>
            <Label htmlFor={`${id}-room-amount`}>{t("roomAmount")}</Label>
            <Input
              id={`${id}-room-amount`}
              inputMode="decimal"
              required
              value={value.room.amount}
              onChange={(event) =>
                onChange({ ...value, room: { ...value.room, amount: event.target.value } })
              }
            />
          </>
        )}
        {value.room.kind === "percentage" && (
          <>
            <Label htmlFor={`${id}-room-rate`}>{t("roomRate")}</Label>
            <Input
              id={`${id}-room-rate`}
              inputMode="decimal"
              required
              value={value.room.rate}
              onChange={(event) =>
                onChange({ ...value, room: { ...value.room, rate: event.target.value } })
              }
            />
            <BasisFields
              value={value.room}
              onChange={(next) => onChange({ ...value, room: { ...value.room, ...next } })}
            />
          </>
        )}
        <Label htmlFor={`${id}-order`}>{t("roomOrder")}</Label>
        <select
          id={`${id}-order`}
          required
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={value.room.order}
          onChange={(event) =>
            onChange({ ...value, room: { ...value.room, order: event.target.value } })
          }
        >
          <option value="">{t("choose")}</option>
          {["before_instructor_share", "after_instructor_share"].map((order) => (
            <option key={order} value={order}>
              {t(order)}
            </option>
          ))}
        </select>
      </fieldset>
      <Button
        type="button"
        variant="outline"
        onClick={() => setProductsOpen((v) => !v)}
        aria-expanded={productsOpen}
      >
        {t("packageTerms")}
      </Button>
      {productsOpen && <PackageTerms scope={scope} api={api} value={value} onChange={onChange} />}
      <p className="text-sm text-muted-foreground">{t("packageHint")}</p>
    </div>
  );
}
function PackageTerms({
  scope,
  api,
  value,
  onChange,
}: {
  scope: SetupScope;
  api: AgreementApi;
  value: PayDraft;
  onChange: (value: PayDraft) => void;
}) {
  const t = useTranslations("agreements"),
    id = useId();
  const [result, setResult] = useState<{
      page?: Awaited<ReturnType<AgreementApi["products"]>>;
      error?: string;
    } | null>(null),
    [cursor, setCursor] = useState<string>();
  useEffect(() => {
    const life = new AbortController();
    void api
      .products(scope, cursor)
      .then((page) => {
        if (!life.signal.aborted) setResult({ page });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, cursor]);
  return (
    <div className="space-y-3">
      {!result ? (
        <output>{t("loading")}</output>
      ) : result.error ? (
        <FlowError code={result.error} />
      ) : (
        <>
          <Label htmlFor={id}>{t("package")}</Label>
          <select
            id={id}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value=""
            onChange={(event) => {
              const row = result.page?.items.find((p) => p.id === event.target.value);
              if (row && !value.packages.some((p) => p.productId === row.id))
                onChange({
                  ...value,
                  packages: [
                    ...value.packages,
                    { productId: row.id, name: row.terms.name, components: [emptyComponent()] },
                  ],
                });
            }}
          >
            <option value="">{t("choose")}</option>
            {result.page?.items.map((row) => (
              <option key={row.version_id} value={row.id}>
                {row.terms.name}
              </option>
            ))}
          </select>
          {result.page?.next_cursor && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setResult(null);
                setCursor(result.page!.next_cursor!);
              }}
            >
              {t("more")}
            </Button>
          )}
        </>
      )}
      {value.packages.map((p, index) => (
        <fieldset key={p.productId} className="space-y-3 rounded-md border p-3">
          <legend>{p.name ?? t("packageNumber", { number: index + 1 })}</legend>
          <PayComponents
            packageOnly
            value={p.components}
            onChange={(components) =>
              onChange({
                ...value,
                packages: value.packages.map((v, i) => (i === index ? { ...v, components } : v)),
              })
            }
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({ ...value, packages: value.packages.filter((_, i) => i !== index) })
            }
          >
            {t("removePackage")}
          </Button>
        </fieldset>
      ))}
    </div>
  );
}
