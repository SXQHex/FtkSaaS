"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import type { LeadRecord } from "../../lib/crm";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { SessionView, ProductView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { listProducts } from "../../lib/products";

import { useRemote } from "../../lib/use-remote";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { FlowError } from "../bookings/flow-controls";
import { CommandReview } from "./command-review";
import { SessionPicker } from "./session-picker";
import { control, button } from "./fields";
import { TrialOffers } from "./trial-offers";
export function Trials({
  scope,
  lead,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  lead: LeadRecord;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations("crm"),
    formatter = useFormatter(),
    [product, setProduct] = useState<ProductView>(),
    [session, setSession] = useState<SessionView>(),
    [category, setCategory] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [command, setCommand] = useState<SetupCommand | null>(null);
  const load = useCallback(() => listProducts(scope, cursor), [scope, cursor]);
  const products = useRemote(load, JSON.stringify([scope, cursor, revision]));
  return (
    <section aria-label={t("trials")} className="space-y-4">
      <h4 className="font-semibold">{t("trials")}</h4>
      <p>{t("trialHint")}</p>
      {!products && <output>{t("loading")}</output>}
      {products?.error && <FlowError code={products.error} />}{" "}
      {products?.data && (
        <>
          <label>
            {t("product")}
            <select
              className={control}
              value={product?.version_id ?? ""}
              onChange={(e) => {
                setProduct(products.data!.items.find((p) => p.version_id === e.target.value));
                setCommand(null);
              }}
            >
              <option value="">{t("choose")}</option>
              {products.data.items.map((p) => (
                <option key={p.version_id} value={p.version_id}>
                  {p.terms.name}
                </option>
              ))}
            </select>
          </label>
          {products.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => setCursor(products.data!.next_cursor!)}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      <SessionPicker
        scope={scope}
        timeZone={timeZone}
        onSelect={(s) => {
          setSession(s);
          setCategory("");
          setCommand(null);
        }}
      />
      {session && (
        <p>
          {t("selectedSession")}{" "}
          {formatter.dateTime(new Date(session.starts_at), {
            timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · {timeZone}
        </p>
      )}
      {session?.capacity.categories && (
        <label>
          {t("category")}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCommand(null);
            }}
            className={control}
          >
            <option value="">{t("choose")}</option>
            {Object.keys(session.capacity.categories).map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        className={button}
        disabled={!product || !session || (!!session.capacity.categories && !category)}
        onClick={() => {
          if (product && session)
            setCommand({
              operation: "trial_offer_create_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                lead_id: lead.id,
                product_version_id: product.version_id,
                session_id: session.id,
                ...(session.capacity.categories
                  ? { booking_category: category as "male" | "female" }
                  : {}),
              },
            });
        }}
      >
        {t("createOffer")}
      </Button>
      <CommandReview
        scope={scope}
        slot={`crm-lead:${lead.id}`}
        command={command}
        onBack={() => setCommand(null)}
        onDone={() => {
          setCommand(null);
          setRevision((n) => n + 1);
          onSaved();
        }}
      >
        <p>
          {product?.terms.name} ·{" "}
          {session &&
            formatter.dateTime(new Date(session.starts_at), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
          · {timeZone}
        </p>
        <p>{t("trialHint")}</p>
      </CommandReview>
      {product && (
        <TrialOffers
          key={`${lead.id}:${product.version_id}:${session?.id}:${revision}`}
          scope={scope}
          lead={lead}
          productId={product.version_id}
          sessionId={session?.id}
          timeZone={timeZone}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
