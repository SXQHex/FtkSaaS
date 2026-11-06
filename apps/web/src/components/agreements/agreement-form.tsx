"use client";
import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  AgreementVersionView,
  ScheduleConfigurationRequirement,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  agreementCommand,
  emptyPayDraft,
  payTerms,
  type AgreementDraft,
} from "../../lib/agreement-command";
import type { AgreementApi } from "../../lib/agreements";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { LocalTimeField } from "../programs/local-time-field";
import { PayTermsFields } from "./pay-terms-fields";
import { PayTermsSummary } from "./pay-terms-summary";
export function AgreementForm({
  scope,
  personId,
  timeZone,
  prior,
  requirement,
  api,
  onSaved,
  onRejected,
  onCancel,
}: {
  scope: SetupScope;
  personId: string;
  timeZone: string;
  prior?: AgreementVersionView;
  requirement?: ScheduleConfigurationRequirement;
  api: AgreementApi;
  onSaved: () => void;
  onRejected: (code: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("agreements"),
    flow = useTranslations("flows"),
    format = useFormatter(),
    id = useId();
  const [draft, setDraft] = useState<AgreementDraft>({
      disciplineId: prior?.discipline_id ?? requirement?.discipline_id ?? "",
      format: prior?.format ?? requirement?.format ?? "",
      starts: "",
      ends: "",
      startOffset: "",
      endOffset: "",
      reason: "",
    }),
    [pay, setPay] = useState(emptyPayDraft),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const [catalog, setCatalog] = useState<{
      rows?: Awaited<ReturnType<AgreementApi["disciplines"]>>;
      error?: string;
    } | null>(null),
    [attempt, setAttempt] = useState(0);
  const command = useSetupCommand(scope, `agreements:${personId}`, onSaved, onRejected),
    disabled = command.busy || !!command.pending;
  useEffect(() => {
    const life = new AbortController();
    void api
      .disciplines(scope)
      .then((rows) => {
        if (!life.signal.aborted) setCatalog({ rows });
      })
      .catch((cause) => {
        if (!life.signal.aborted) setCatalog({ error: flowError(cause) });
      });
    return () => life.abort();
  }, [api, scope, attempt]);
  const change = (next: Partial<AgreementDraft>) => {
    setReview(null);
    setError("");
    setDraft((current) => ({ ...current, ...next }));
  };
  if (!catalog) return <output>{t("loading")}</output>;
  if (catalog.error)
    return (
      <div>
        <FlowError code={catalog.error} />
        <Button
          variant="outline"
          onClick={() => {
            setCatalog(null);
            setAttempt((v) => v + 1);
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  return (
    <section className="space-y-4 border-t pt-4" aria-label={t(prior ? "newVersion" : "create")}>
      <h5 className="font-semibold">{t(prior ? "newVersion" : "create")}</h5>
      <p className="text-sm text-muted-foreground">{t("immutable")}</p>
      {prior && <p>{t("replaces", { version: prior.version })}</p>}
      <SetupFeedback command={command} />
      <form
        className="space-y-4"
        onChange={() => setReview(null)}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          try {
            if (!catalog.rows?.some((row) => row.id === draft.disciplineId))
              throw Error("invalidAgreement");
            setReview(agreementCommand(scope, personId, timeZone, draft, payTerms(pay), prior));
            setError("");
          } catch {
            setReview(null);
            setError("invalidAgreement");
          }
        }}
      >
        <fieldset disabled={disabled} className="space-y-4">
          <Label htmlFor={`${id}-discipline`}>{t("discipline")}</Label>
          <select
            id={`${id}-discipline`}
            required
            disabled={!!prior || !!requirement}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={draft.disciplineId}
            onChange={(event) => change({ disciplineId: event.target.value })}
          >
            <option value="">{t("choose")}</option>
            {catalog.rows?.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <Label htmlFor={`${id}-format`}>{t("format")}</Label>
          <select
            id={`${id}-format`}
            required
            disabled={!!prior || !!requirement}
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={draft.format}
            onChange={(event) => change({ format: event.target.value })}
          >
            <option value="">{t("choose")}</option>
            <option value="group">{t("group")}</option>
            <option value="private">{t("private")}</option>
          </select>
          <LocalTimeField
            label={t("starts")}
            value={draft.starts}
            choice={draft.startOffset}
            timeZone={timeZone}
            onChange={(starts) => change({ starts, startOffset: "" })}
            onChoice={(startOffset) => change({ startOffset })}
          />
          <LocalTimeField
            label={t("ends")}
            value={draft.ends}
            choice={draft.endOffset}
            timeZone={timeZone}
            onChange={(ends) => change({ ends, endOffset: "" })}
            onChoice={(endOffset) => change({ endOffset })}
          />
          <PayTermsFields
            scope={scope}
            api={api}
            value={pay}
            onChange={(next) => {
              setReview(null);
              setPay(next);
              setError("");
            }}
          />
          <Label htmlFor={`${id}-reason`}>{t("reason")}</Label>
          <Input
            id={`${id}-reason`}
            required
            maxLength={10000}
            value={draft.reason}
            onChange={(event) => change({ reason: event.target.value })}
          />
          <Button>{flow("review")}</Button>
        </fieldset>
      </form>
      {error && <p role="alert">{t(error)}</p>}
      {review?.operation === "instructor_agreement_publish_v1" && (
        <ConfirmWrite
          key={review.input.operation_key}
          command={review}
          controller={command}
          onBack={() => setReview(null)}
        >
          <p>{t(prior ? "newVersion" : "create")}</p>
          <p>
            {catalog.rows?.find((row) => row.id === draft.disciplineId)?.name} · {t(draft.format)}
          </p>
          <p>
            {format.dateTime(new Date(review.input.valid.starts_at), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            —{" "}
            {format.dateTime(new Date(review.input.valid.ends_at), {
              timeZone,
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · {timeZone}
          </p>
          <p>{review.input.reason}</p>
          <PayTermsSummary terms={review.input.terms} packages={pay.packages} />
          <p>{t("immutable")}</p>
        </ConfirmWrite>
      )}
      <Button variant="outline" disabled={command.busy} onClick={onCancel}>
        {t("back")}
      </Button>
    </section>
  );
}
