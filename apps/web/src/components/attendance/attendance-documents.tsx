"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { DocumentView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import {
  documentReadActions,
  type DocumentReadActions,
  type DocumentQuery,
} from "../../lib/document-requirements";
import type { SetupScope } from "../../lib/studio-setup";
import { PrivateDocument } from "../documents/private-document";
import { flowError } from "../bookings/flow-controls";
import { AttendanceError } from "./attendance-error";
export function AttendanceDocuments({
  scope,
  reservationId,
  personId,
  actions = documentReadActions,
}: {
  scope: SetupScope;
  reservationId: string;
  personId: string;
  actions?: DocumentReadActions;
}) {
  const t = useTranslations("documents"),
    [query] = useState<DocumentQuery>({
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      context: { gate: "attendance", subject: { type: "reservations", id: reservationId } },
    });
  const [result, setResult] = useState<{ rows?: DocumentView[]; error?: string } | null>(null),
    [attempt, setAttempt] = useState(0),
    [selected, setSelected] = useState<DocumentView | null>(null),
    source = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const life = new AbortController();
    void actions
      .read(query)
      .then((rows) => {
        if (!life.signal.aborted) setResult({ rows });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setResult({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [actions, query, attempt]);
  return (
    <section aria-label={t("requirementsTitle")} className="space-y-3 rounded-md border p-4">
      <h5 className="font-semibold">{t("requirementsTitle")}</h5>
      <p className="text-sm text-muted-foreground">{t("readOnlyDocuments")}</p>
      <Button
        variant="outline"
        onClick={() => {
          setSelected(null);
          setResult(null);
          setAttempt((v) => v + 1);
        }}
      >
        {t("reload")}
      </Button>
      {!result ? (
        <output aria-live="polite">{t("loading")}</output>
      ) : result.error ? (
        <AttendanceError code={result.error} />
      ) : (
        <>
          {result.rows?.some((doc) => !doc.accepted) && (
            <p className="text-sm">{t("acceptanceRequiredHint")}</p>
          )}
          {!result.rows?.length && <p>{t("noRequirements")}</p>}
          <ul className="space-y-3">
            {result.rows?.map((doc) => (
              <li key={`${doc.version_id}:${doc.file.id}`}>
                <p>
                  {doc.name} · {t(doc.accepted ? "requirementMet" : "acceptanceRequired")}
                </p>
                <Button
                  variant="outline"
                  className="h-auto min-h-11 whitespace-normal"
                  onClick={(event) => {
                    source.current = event.currentTarget;
                    setSelected(doc);
                  }}
                >
                  {t("openDocument", { name: doc.name })}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {selected && (
        <PrivateDocument
          key={`${selected.version_id}:${selected.file.id}`}
          query={query}
          expected={selected}
          read={actions.file}
          onClose={() => {
            setSelected(null);
            requestAnimationFrame(() => source.current?.focus());
          }}
        />
      )}
    </section>
  );
}
