"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { organizationRecoveries } from "../../lib/organization-recovery";
import { freshAccountProof } from "../../lib/account";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
import { ReauthFields } from "../account/session-manager";
import { JobProgress } from "../reports/job-progress";
import { FlowError, flowError } from "../bookings/flow-controls";
export function OrganizationRecovery({ actorId }: { actorId: string }) {
  const t = useTranslations("subscription"),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  let records: ReturnType<typeof organizationRecoveries> = [];
  let readError = "";
  try {
    records = organizationRecoveries(actorId);
  } catch (cause) {
    readError = flowError(cause);
  }
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">{t("deletionTracking")}</h3>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={() => {
          try {
            organizationRecoveries(actorId);
            setError("");
            setRevision((n) => n + 1);
          } catch (e) {
            setError(flowError(e));
          }
        }}
      >
        {t("refresh")}
      </Button>
      {(error || readError) && <FlowError code={error || readError} />}
      {records.map((r, i) => (
        <RecoveryItem
          key={`${r.scope.orgId}:${revision}`}
          record={r}
          number={i + 1}
          onSaved={() => setRevision((n) => n + 1)}
        />
      ))}
    </section>
  );
}
function RecoveryItem({
  record,
  number,
  onSaved,
}: {
  record: ReturnType<typeof organizationRecoveries>[number];
  number: number;
  onSaved: () => void;
}) {
  const t = useTranslations("subscription"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const command = useSetupCommand(record.scope, "organization-delete", onSaved);
  return (
    <section className="space-y-3 border-t pt-3">
      <h4>{t("deletionItem", { number })}</h4>
      <p>{t("deletionPending")}</p>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      {record.pending &&
        command.pending !== "invalid" &&
        !(command.pending && command.pending.blocked) && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || command.busy) return;
              const form = e.currentTarget,
                d = new FormData(form);
              setBusy(true);
              setError("");
              try {
                const proof = await freshAccountProof(
                  record.scope.actorId,
                  String(d.get("password") ?? ""),
                  String(d.get("code") ?? ""),
                );
                form.reset();
                await command.run(undefined, proof);
              } catch (e) {
                setError(flowError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>{t("retryDeletion")}</p>
            <ReauthFields disabled={busy || command.busy} />
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" required disabled={busy || command.busy} />
              {t("deleteConfirm")}
            </label>
            <Button variant="destructive" disabled={busy || command.busy}>
              {t("retryDeletion")}
            </Button>
          </form>
        )}
      {record.job && <JobProgress scope={record.scope} id={record.job} />}
    </section>
  );
}
