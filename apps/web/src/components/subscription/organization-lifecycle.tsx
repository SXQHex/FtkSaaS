"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { setupCall, type SetupScope, type SetupCommand } from "../../lib/studio-setup";
import { freshAccountProof } from "../../lib/account";
import { restoreJob } from "../../lib/job-record";
import { useRemote } from "../../lib/use-remote";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { ReauthFields } from "../account/session-manager";
import { JobProgress } from "../reports/job-progress";
export function OrganizationLifecycle({
  scope,
  onChanged,
}: {
  scope: SetupScope;
  onChanged?: () => void;
}) {
  const t = useTranslations("subscription"),
    [revision, setRevision] = useState(0),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"close" | "delete">("close");
  const [job, setJob] = useState(() => {
    try {
      return restoreJob(scope, "organization-delete");
    } catch {
      return null;
    }
  });
  const load = useCallback(
      () => setupCall("organization_get_v1", { org_id: scope.orgId }),
      [scope],
    ),
    org = useRemote(load, JSON.stringify([scope, revision]));
  const refresh = () => {
    setReview(null);
    setPreview(null);
    setRevision((n) => n + 1);
    onChanged?.();
  };
  const close = useSetupCommand(scope, "organization-close", refresh),
    reopen = useSetupCommand(scope, "organization-reopen", refresh),
    remove = useSetupCommand(scope, "organization-delete", (id) => {
      if (id) setJob(id);
      refresh();
    });
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(
      () => {
        setReview(null);
        setPreview(null);
        setError("PREVIEW_STALE");
      },
      Math.max(0, Math.min(2147483647, Date.parse(preview.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [preview]);
  const blocked =
    busy ||
    close.busy ||
    reopen.busy ||
    remove.busy ||
    !!close.pending ||
    !!reopen.pending ||
    !!remove.pending;
  async function prepare(kind: "close" | "delete") {
    if (blocked) return;
    setBusy(true);
    setError("");
    setReview(null);
    setPreview(null);
    setMode(kind);
    try {
      if (!reason.trim()) throw Error("invalidPlanChange");
      const p =
        kind === "close"
          ? await setupCall("organization_close_preview_v1", {
              org_id: scope.orgId,
              reason: reason.trim(),
            })
          : await setupCall("organization_delete_preview_v1", {
              org_id: scope.orgId,
              reason: reason.trim(),
              all_data: true,
            });
      setPreview(p);
      if (p.blockers.length || Date.parse(p.expires_at) <= Date.now()) return;
      const v = p.dependencies.versions.find(
        (v) => v.entity.type === "organizations" && v.entity.id === scope.orgId,
      )?.version;
      if (kind === "close" && !v) throw Error("invalidPlanChange");
      setReview(
        kind === "close"
          ? {
              operation: "organization_close_apply_v1",
              input: {
                org_id: scope.orgId,
                operation_key: v7(),
                expected_version: v!,
                preview: { id: p.id, token: p.token },
              },
            }
          : {
              operation: "organization_delete_apply_v1",
              input: {
                org_id: scope.orgId,
                operation_key: v7(),
                all_data: true,
                preview: { id: p.id, token: p.token },
              },
            },
      );
    } catch (e) {
      setError(flowError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("lifecycle")}>
      <h3 className="font-semibold">{t("lifecycle")}</h3>
      <p>{t("lifecycleHint")}</p>
      <a className="underline" href="#reports">
        {t("exportFirst")}
      </a>
      <SetupFeedback command={close} />
      <SetupFeedback command={reopen} />
      <SetupFeedback command={remove} />
      {error && <FlowError code={error} />}
      {!org ? (
        <output>{t("loading")}</output>
      ) : org.error ? (
        <FlowError code={org.error} />
      ) : (
        org.data && (
          <>
            <p>
              {t("organizationState")}: {t(`organizationStates.${org.data.state}`)}
            </p>
            <label className="block">
              {t("reason")}
              <Input
                value={reason}
                disabled={blocked}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReview(null);
                  setPreview(null);
                }}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              {org.data.state === "active" && (
                <Button variant="outline" disabled={blocked} onClick={() => void prepare("close")}>
                  {t("close")}
                </Button>
              )}
              {org.data.state === "closed" && (
                <Button
                  className="h-auto min-h-11 max-w-full whitespace-normal"
                  variant="outline"
                  disabled={blocked}
                  onClick={() => {
                    setPreview(null);
                    setReview({
                      operation: "organization_reopen_v1",
                      input: { org_id: scope.orgId, operation_key: v7() },
                    });
                  }}
                >
                  {t("reopen")}
                </Button>
              )}
              {!["deleted", "deletion_pending"].includes(org.data.state) && (
                <Button
                  className="h-auto min-h-11 max-w-full whitespace-normal"
                  variant="destructive"
                  disabled={blocked}
                  onClick={() => void prepare("delete")}
                >
                  {t("delete")}
                </Button>
              )}
              <Button variant="outline" disabled={busy} onClick={refresh}>
                {t("refresh")}
              </Button>
            </div>
          </>
        )
      )}
      {preview && <LifecycleImpact preview={preview} />}
      {review && review.operation !== "organization_delete_apply_v1" && !blocked && (
        <ConfirmWrite
          command={review}
          controller={review.operation === "organization_reopen_v1" ? reopen : close}
          onBack={() => setReview(null)}
        >
          <p>{t(review.operation === "organization_reopen_v1" ? "reopenHint" : "closeHint")}</p>
        </ConfirmWrite>
      )}
      {(remove.pending ||
        (mode === "delete" && review?.operation === "organization_delete_apply_v1")) && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || remove.busy) return;
            const form = e.currentTarget,
              d = new FormData(form);
            if (!remove.pending && (!preview || Date.parse(preview.expires_at) <= Date.now())) {
              setError("PREVIEW_STALE");
              setReview(null);
              return;
            }
            setBusy(true);
            setError("");
            try {
              const proof = await freshAccountProof(
                scope.actorId,
                String(d.get("password") ?? ""),
                String(d.get("code") ?? ""),
              );
              form.reset();
              await remove.run(review ?? undefined, proof);
            } catch (e) {
              setError(flowError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>{t("deleteHint")}</p>
          <ReauthFields disabled={busy || remove.busy} />
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" required disabled={busy || remove.busy} />
            {t("deleteConfirm")}
          </label>
          <Button variant="destructive" disabled={busy || remove.busy}>
            {t(remove.pending ? "retryDeletion" : "deleteConfirm")}
          </Button>
        </form>
      )}
      {job && (
        <>
          <p>{t("deletionPending")}</p>
          <JobProgress scope={scope} id={job} />
        </>
      )}
    </section>
  );
}
function LifecycleImpact({ preview }: { preview: Preview }) {
  const t = useTranslations("account"),
    s = useTranslations("subscription"),
    f = useFormatter();
  return (
    <section className="space-y-3 border p-3" aria-label={s("impact")}>
      <p>
        {s("expires")}:{" "}
        {f.dateTime(new Date(preview.expires_at), { dateStyle: "medium", timeStyle: "short" })}
      </p>
      {preview.blockers.map((b, i) => (
        <FlowError key={i} code={b.code} />
      ))}
      {preview.lifecycle_impact && (
        <dl>
          {(
            [
              "active_account_links",
              "open_sessions",
              "open_requests",
              "active_reservations",
              "active_event_registrations",
              "open_debts",
              "student_credit_accounts",
            ] as const
          ).map((k) => (
            <div className="flex flex-wrap justify-between gap-3" key={k}>
              <dt>{t(`impact.${k}`)}</dt>
              <dd>{preview.lifecycle_impact![k]}</dd>
            </div>
          ))}
        </dl>
      )}
      <p>{s("lifecycleHint")}</p>
    </section>
  );
}
