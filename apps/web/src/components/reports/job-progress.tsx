"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { JobStatusView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { readJob } from "../../lib/job-record";
import { useRemote } from "../../lib/use-remote";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError } from "../bookings/flow-controls";
export function JobProgress({
  scope,
  id,
  onRead,
}: {
  scope: SetupScope;
  id: string;
  onRead?: (job: JobStatusView | null) => void;
}) {
  const account = useTranslations("account");
  const t = useTranslations("reports"),
    f = useFormatter(),
    [revision, setRevision] = useState(0),
    load = useCallback(() => readJob(scope, id), [scope, id]),
    state = useRemote(load, JSON.stringify([scope, id, revision]));
  useEffect(() => {
    onRead?.(state?.data ?? null);
  }, [state?.data, onRead]);
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label={t("job")}>
      <h3 className="font-semibold">{t("job")}</h3>
      <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
        {t("refresh")}
      </Button>
      {!state ? (
        <output>{t("loading")}</output>
      ) : state.error ? (
        <FlowError code={state.error} />
      ) : (
        state.data && (
          <>
            <p>
              {t(`states.${state.data.state}`)} · {state.data.progress_count}
              {state.data.total_count !== null ? ` / ${state.data.total_count}` : ""}
            </p>
            {state.data.privacy && (
              <section className="space-y-2">
                <p>
                  {account("privacyState")}:{" "}
                  {account(`privacyStates.${state.data.privacy.request_state}`)}
                </p>
                {state.data.privacy.completed_at && (
                  <p>
                    {f.dateTime(new Date(state.data.privacy.completed_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                {state.data.privacy.pending_scopes.length > 0 && (
                  <>
                    <p>{account("pendingScopes")}</p>
                    <ul>
                      {state.data.privacy.pending_scopes.map((scope) => (
                        <li key={scope}>{account(`privacyScopes.${scope}`)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
            {state.data.safe_error_code && <FlowError code={state.data.safe_error_code} />}
            {state.data.email_delivery && (
              <p>
                {t(`email.${state.data.email_delivery.state}`)}
                {state.data.email_delivery.occurred_at &&
                  ` · ${f.dateTime(new Date(state.data.email_delivery.occurred_at), { dateStyle: "medium", timeStyle: "short" })}`}
              </p>
            )}
          </>
        )
      )}
    </section>
  );
}
