"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { EntitlementView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { rightsApi, type RightsApi } from "../../lib/rights";
import type { SetupScope } from "../../lib/studio-setup";
import type { useSetupCommand } from "../setup/setup-command";
import { NegativeRights } from "./negative-rights";
import { RightsForm } from "./rights-form";
export function RightsManagement({
  scope,
  personId,
  rows,
  command,
  api = rightsApi,
}: {
  scope: SetupScope;
  personId: string;
  rows: EntitlementView[];
  command: ReturnType<typeof useSetupCommand>;
  api?: RightsApi;
}) {
  const t = useTranslations("rights"),
    format = useFormatter(),
    [kind, setKind] = useState<"credit_adjust" | "entitlement_extend" | "negative_limit" | null>(
      null,
    ),
    [saleId, setSaleId] = useState(""),
    id = useId(),
    heading = useRef<HTMLHeadingElement>(null);
  const locked = command.busy || !!command.pending;
  const eligible = rows.filter(
    (row) =>
      row.person_id === personId &&
      row.state === "active" &&
      row.sale_state === "active" &&
      Number.isSafeInteger(row.version) &&
      Number(row.version) > 0 &&
      (kind !== "credit_adjust" || row.kind === "credits"),
  );
  const row = eligible.find((item) => item.sale_id === saleId);
  return (
    <section className="min-w-0 space-y-4 border-t pt-4" aria-label={t("title")}>
      <h4 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("title")}
      </h4>
      <div className="flex flex-wrap gap-3">
        {(["credit_adjust", "entitlement_extend", "negative_limit"] as const).map((value) => (
          <Button
            type="button"
            key={value}
            variant={kind === value ? "default" : "outline"}
            className="h-auto min-h-11 max-w-full whitespace-normal"
            disabled={locked}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setSaleId("");
            }}
          >
            {t(`kinds.${value}`)}
          </Button>
        ))}
      </div>
      {kind && (
        <div className="space-y-4 rounded-lg border p-4">
          {kind === "negative_limit" ? (
            <NegativeRights scope={scope} personId={personId} command={command} api={api} />
          ) : (
            <>
              <Label htmlFor={id}>{t("chooseRight")}</Label>
              <select
                id={id}
                value={saleId}
                disabled={locked}
                className="h-auto min-h-11 w-full rounded-md border bg-background px-3"
                onChange={(event) => setSaleId(event.target.value)}
              >
                <option value="">{t("chooseRight")}</option>
                {eligible.map((item) => (
                  <option key={item.sale_id} value={item.sale_id}>
                    {t("rightOption", {
                      number: rows.findIndex((row) => row.sale_id === item.sale_id) + 1,
                      start: format.dateTime(new Date(`${item.start_date}T12:00:00Z`), {
                        timeZone: "UTC",
                        dateStyle: "short",
                      }),
                      end: format.dateTime(new Date(`${item.end_date}T12:00:00Z`), {
                        timeZone: "UTC",
                        dateStyle: "short",
                      }),
                    })}
                  </option>
                ))}
              </select>
              {!eligible.length && <p>{t("noEditableRights")}</p>}
              {row && (
                <RightsForm
                  key={`${kind}:${row.sale_id}`}
                  scope={scope}
                  personId={personId}
                  target={{ kind, row }}
                  api={api}
                  command={command}
                />
              )}
            </>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-11 max-w-full whitespace-normal"
            disabled={command.busy}
            onClick={() => {
              setKind(null);
              setSaleId("");
              heading.current?.focus();
            }}
          >
            {t("close")}
          </Button>
        </div>
      )}
    </section>
  );
}
