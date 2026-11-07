"use client";
import { useCallback, useMemo, useState } from "react";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { v7 } from "uuid";
import type { SubscriptionDowngradeOption, StarterRetainedScope } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { getCenters } from "../../lib/api";
import { readSubscription, readDowngrade, readPlanChange } from "../../lib/plan-downgrade";
import type { SetupScope, SetupCommand } from "../../lib/studio-setup";
import { useRemote } from "../../lib/use-remote";
import { effectMoney } from "../../lib/effect-money";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { RetentionForm } from "./retention-form";
const control = "min-h-11 w-full rounded-md border bg-background px-3";
export function PlanDowngrade({ scope }: { scope: SetupScope }) {
  const t = useTranslations("planChange"),
    [open, setOpen] = useState(false);
  return (
    <section className="space-y-4 border-t pt-5" aria-label={t("title")}>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("title")}
      </Button>
      {open && <DowngradePanel scope={scope} />}
    </section>
  );
}
function DowngradePanel({ scope }: { scope: SetupScope }) {
  const t = useTranslations("planChange"),
    f = useFormatter(),
    locale = useLocale(),
    [revision, setRevision] = useState(0),
    [targetId, setTargetId] = useState(""),
    [centerId, setCenterId] = useState("");
  const load = useCallback(() => readSubscription(scope), [scope]),
    result = useRemote(load, JSON.stringify([scope, revision]));
  const centersLoad = useCallback(() => getCenters(scope.orgId), [scope.orgId]),
    centers = useRemote(centersLoad, JSON.stringify([scope.orgId, revision]));
  const option = result?.data?.billing?.downgrade_options?.find((o) => o.target.id === targetId);
  const center = centers?.data?.find(
    (c) => c.id === centerId && c.accessible && c.state === "active",
  );
  const needsCenter = !!option && (option.kept_center_required || option.plan === "starter");
  const centerScope = useMemo(
    () => (center ? { ...scope, centerId: center.id } : undefined),
    [scope, center],
  );
  const saved = () => {
    setTargetId("");
    setCenterId("");
    setRevision((n) => n + 1);
  };
  return (
    <div className="space-y-4">
      <p>{t("hint")}</p>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        onClick={saved}
      >
        {t("reload")}
      </Button>
      {!result && <output>{t("loading")}</output>}
      {result?.error && <FlowError code={result.error} />}
      {result?.data?.pending_change && (
        <CancelChange
          key={result.data.pending_change.id}
          scope={scope}
          changeId={result.data.pending_change.id}
          onSaved={saved}
        />
      )}
      {result?.data && (
        <>
          <label className="block space-y-2">
            {t("target")}
            <select
              className={control}
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setCenterId("");
              }}
            >
              <option value="">{t("choose")}</option>
              {(result.data.billing?.downgrade_options ?? []).map((o) => (
                <option key={o.target.id} value={o.target.id}>
                  {t(o.plan)} · {t(o.target.period)} ·{" "}
                  {effectMoney(o.target.amount_minor, o.target.currency, locale)}
                </option>
              ))}
            </select>
          </label>
          {!result.data.billing?.downgrade_options?.length && <p>{t("noTargets")}</p>}
        </>
      )}
      {option && (
        <>
          <p>
            {t("effective")}{" "}
            {f.dateTime(new Date(option.effective_at), { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {centers?.error && <FlowError code={centers.error} />}
          {!centers && <output>{t("loading")}</output>}
          {needsCenter && (
            <label className="block space-y-2">
              {t("center")}
              <select
                className={control}
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
              >
                <option value="">{t("choose")}</option>
                {centers?.data
                  ?.filter((c) => c.accessible && c.state === "active")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {(!needsCenter || (center && centerScope)) && (
            <DowngradeRequest
              key={`${targetId}:${center?.id ?? "organization"}:${revision}`}
              scope={scope}
              centerScope={centerScope}
              option={option}
              subscriptionVersion={result!.data!.subscription_version!}
              centerName={center?.name}
              onSaved={saved}
            />
          )}
        </>
      )}
    </div>
  );
}
function DowngradeRequest({
  scope,
  centerScope,
  option,
  subscriptionVersion,
  centerName,
  onSaved,
}: {
  scope: SetupScope;
  centerScope?: SetupScope;
  option: SubscriptionDowngradeOption;
  subscriptionVersion: number;
  centerName?: string;
  onSaved: () => void;
}) {
  const t = useTranslations("planChange"),
    [review, setReview] = useState<SetupCommand | null>(null),
    [labels, setLabels] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const command = useSetupCommand(scope, `subscription-downgrade:${option.target.id}`, onSaved);
  async function prepare(keptScope?: StarterRetainedScope, names: string[] = []) {
    if (busy || command.pending) return;
    setBusy(true);
    setReview(null);
    setError("");
    try {
      const version = await readDowngrade(scope, option.target.id);
      if (version !== subscriptionVersion) throw Error("VERSION_CONFLICT");
      setLabels(names);
      setReview({
        operation: "subscription_downgrade_request_v1",
        input: {
          org_id: scope.orgId,
          operation_key: v7(),
          target_plan_id: option.target.id,
          ...(centerScope ? { kept_center_id: centerScope.centerId } : {}),
          expected_version: version,
          ...(keptScope ? { kept_scope: keptScope } : {}),
        },
      });
    } catch (e) {
      setError(flowError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <fieldset disabled={busy || command.busy || !!command.pending} className="min-w-0">
        {option.plan === "starter" && centerScope ? (
          <RetentionForm
            scope={centerScope}
            onReview={(s, names) => void prepare(s, names)}
            onDirty={() => setReview(null)}
          />
        ) : (
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            onClick={() => void prepare()}
          >
            {t("review")}
          </Button>
        )}
      </fieldset>
      {review && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          <p>
            {t(option.plan)} · {centerName}
          </p>
          <p>{t("replaceHint")}</p>
          <ul>
            {labels.map((label, i) => (
              <li key={i}>{label}</li>
            ))}
          </ul>
          {review.operation === "subscription_downgrade_request_v1" && review.input.kept_scope && (
            <p>
              {t("selectedCount", { count: review.input.kept_scope.student_person_ids.length })}
            </p>
          )}
          <p>{t("retentionHint")}</p>
        </ConfirmWrite>
      )}
    </div>
  );
}
function CancelChange({
  scope,
  changeId,
  onSaved,
}: {
  scope: SetupScope;
  changeId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("planChange"),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    command = useSetupCommand(scope, `subscription-cancel:${changeId}`, onSaved);
  return (
    <section className="space-y-3 rounded-md border p-3">
      <p>{t("pending")}</p>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={busy || command.busy || !!command.pending}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const version = await readPlanChange(scope, changeId);
            setReview({
              operation: "subscription_change_cancel_v1",
              input: {
                org_id: scope.orgId,
                operation_key: v7(),
                change_id: changeId,
                expected_version: version,
              },
            });
          } catch (e) {
            setError(flowError(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("cancel")}
      </Button>
      {review && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          <p>{t("cancelHint")}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
