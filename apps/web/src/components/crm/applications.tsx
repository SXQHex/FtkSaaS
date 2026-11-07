"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@ftksaas/ui/components/button";
import { crmApi, sourceVersion } from "../../lib/crm";
import { useRemote } from "../../lib/use-remote";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError } from "../bookings/flow-controls";

import { button } from "./fields";
import { ApplicationDetail } from "./application-detail";
export function Applications({
  scope,
  timeZone,
  destinations = [],
}: {
  scope: SetupScope;
  timeZone: string;
  destinations?: { id: string; name: string }[];
}) {
  const t = useTranslations("crm"),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState("");
  const load = useCallback(
    () => crmApi.management(scope, { operation: "public_application_review_v1", key: {} }, cursor),
    [scope, cursor],
  );
  const result = useRemote(load, JSON.stringify([scope, cursor, revision]));
  const row = result?.data?.items.find((r) => r.entity?.id === selected);
  return (
    <section className="space-y-4" aria-label={t("applications")}>
      <h3 className="font-semibold">{t("applications")}</h3>
      <p>{t("applicationHint")}</p>
      <Button
        className={button}
        variant="outline"
        onClick={() => {
          setCursor(undefined);
          setRevision((n) => n + 1);
          setSelected("");
        }}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}{" "}
      {result?.data && (
        <>
          <ul className="space-y-3">
            {result.data.items.map((r, i) => {
              const v =
                r.current?.operation === "public_application_review_v1"
                  ? r.current.values
                  : undefined;
              return (
                <li key={r.entity!.id}>
                  <Button
                    className={button}
                    variant="outline"
                    onClick={() => setSelected(r.entity!.id)}
                  >
                    {v?.intake?.display_name ?? t("application", { number: i + 1 })} ·{" "}
                    {r.state && t.has(r.state) ? t(r.state) : t("unknown")}
                  </Button>
                </li>
              );
            })}
          </ul>
          {!result.data.items.length && <p>{t("empty")}</p>}
          {result.data.next_cursor && (
            <Button
              className={button}
              variant="outline"
              onClick={() => {
                setCursor(result.data!.next_cursor!);
                setSelected("");
              }}
            >
              {t("next")}
            </Button>
          )}
        </>
      )}
      {row && (
        <ApplicationDetail
          key={`${row.entity!.id}:${sourceVersion(row)}`}
          destinations={destinations}
          row={row}
          scope={scope}
          timeZone={timeZone}
          onSaved={() => {
            setSelected("");
            setCursor(undefined);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
