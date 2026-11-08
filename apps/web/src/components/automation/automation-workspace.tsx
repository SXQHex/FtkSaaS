"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { WorkspaceScope, type WorkspaceStudios } from "../workspace-scope";
import { readAutomations } from "../../lib/automations";
import {
  automationCommand,
  automationSlot,
  configurationJournalScope,
  type AutomationTarget,
  type AutomationRecord,
  type SegmentRecord,
} from "../../lib/automation-command";
import { useRemote } from "../../lib/use-remote";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { AutomationEditor, SegmentEditor } from "./automation-editor";
import { EmailPreferences } from "./email-preferences";
import { DeliverySettings } from "./delivery-settings";
export function AutomationWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: WorkspaceStudios;
}) {
  return (
    <WorkspaceScope actorId={actorId} studios={studios}>
      {(scope, timeZone) => <AutomationConnection scope={scope} timeZone={timeZone} advanced />}
    </WorkspaceScope>
  );
}
function AutomationConnection({
  scope: initialScope,
  timeZone,
  advanced,
}: {
  scope: SetupScope;
  timeZone: string;
  advanced: boolean;
}) {
  const [scope] = useState(initialScope),
    t = useTranslations("automation"),
    [tab, setTab] = useState<"automation" | "segment" | "preferences">("preferences"),
    [cursor, setCursor] = useState<string>(),
    [target, setTarget] = useState<AutomationTarget>("center"),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<AutomationRecord | SegmentRecord | "new" | null>(null),
    [segments, setSegments] = useState<SegmentRecord[]>([]),
    [segmentNext, setSegmentNext] = useState<string | null | undefined>(),
    [error, setError] = useState("");
  const load = useCallback(
    () =>
      tab === "preferences" ? Promise.resolve(null) : readAutomations(scope, tab, cursor, target),
    [scope, tab, cursor, target],
  );
  const state = useRemote(load, JSON.stringify([scope, tab, cursor, target, revision]));
  function reload() {
    setSelected(null);
    setCursor(undefined);
    setRevision((n) => n + 1);
  }
  const segmentGeneration = useRef(0);
  useEffect(
    () => () => {
      segmentGeneration.current++;
    },
    [],
  );
  async function segmentPage(next?: string) {
    const ticket = ++segmentGeneration.current;
    try {
      const p = await readAutomations(scope, "segment", next, target);
      if (ticket !== segmentGeneration.current) return;
      setSegments((v) => (next ? [...v, ...p.segments] : p.segments));
      setSegmentNext(p.next);
      setError("");
    } catch (e) {
      if (ticket === segmentGeneration.current) setError(flowError(e));
    }
  }
  return (
    <div className="min-w-0 space-y-5 wrap-anywhere">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        {(["preferences", ...(advanced ? ["automation", "segment"] : [])] as const).map((k) => (
          <Button
            key={k}
            variant={tab === k ? "default" : "outline"}
            onClick={() => {
              segmentGeneration.current++;
              setSegments([]);
              setSegmentNext(undefined);
              setTab(k as typeof tab);
              setCursor(undefined);
              setSelected(null);
              setError("");
            }}
          >
            {t(k)}
          </Button>
        ))}
      </div>
      {error && <FlowError code={error} />}
      {tab === "preferences" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <DeliverySettings scope={scope} target="member" />
          <EmailPreferences scope={scope} />
          {advanced && (
            <>
              <DeliverySettings scope={scope} target="organization" />
              <DeliverySettings scope={scope} target="center" />
            </>
          )}
        </div>
      ) : (
        <>
          <label className="block space-y-2">
            {t("configurationScope")}
            <select
              className="min-h-11 w-full rounded-md border bg-background px-3"
              value={target}
              onChange={(e) => {
                segmentGeneration.current++;
                setSegments([]);
                setSegmentNext(undefined);
                setTarget(e.target.value as AutomationTarget);
                setSelected(null);
                setCursor(undefined);
              }}
            >
              <option value="center">{t("centerScope")}</option>
              <option value="organization">{t("organizationScope")}</option>
            </select>
          </label>
          <Button variant="outline" onClick={reload}>
            {t("refresh")}
          </Button>
          <Button
            disabled={!state?.data}
            onClick={() => {
              setSelected("new");
              if (tab === "automation") void segmentPage();
            }}
          >
            {t("create")}
          </Button>
          {!state ? (
            <output>{t("loading")}</output>
          ) : state.error ? (
            <FlowError code={state.error} />
          ) : (
            state.data && (
              <>
                <ul className="space-y-3">
                  {(tab === "automation" ? state.data.automations : state.data.segments).map(
                    (row) => (
                      <li key={row.id} className="rounded-md border p-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelected(row);
                            if (tab === "automation") void segmentPage();
                          }}
                        >
                          {"name" in row ? row.name : row.definition.name}
                        </Button>
                      </li>
                    ),
                  )}
                </ul>
                {!(state.data.automations.length + state.data.segments.length) && (
                  <p>{t("empty")}</p>
                )}
                {state.data.next && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelected(null);
                      setCursor(state.data!.next!);
                    }}
                  >
                    {t("next")}
                  </Button>
                )}
              </>
            )
          )}
          {selected &&
            state?.data &&
            (tab === "segment" ? (
              <SegmentEditor
                target={target}
                key={selected === "new" ? "new" : selected.id}
                scope={scope}
                source={selected === "new" ? null : (selected as SegmentRecord)}
                onSaved={reload}
              />
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => void segmentPage(segmentNext ?? undefined)}
                >
                  {t(segmentNext ? "moreSegments" : "refreshSegments")}
                </Button>
                <AutomationEditor
                  target={target}
                  key={selected === "new" ? "new" : selected.id}
                  scope={scope}
                  source={selected === "new" ? null : (selected as AutomationRecord)}
                  segments={segments}
                  onSaved={reload}
                />
                {selected !== "new" && (
                  <AutomationJobs
                    key={`${selected.id}:${selected.version}`}
                    scope={scope}
                    source={selected as AutomationRecord}
                    timeZone={timeZone}
                    onSaved={reload}
                  />
                )}
              </>
            ))}
        </>
      )}
    </div>
  );
}
export function AutomationJobs({
  scope,
  source,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  source: AutomationRecord;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations("automation"),
    f = useFormatter(),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const command = useSetupCommand(
    configurationJournalScope(scope, source.configKind ?? "center"),
    automationSlot("automation", scope, source.configKind ?? "center", source.id),
    onSaved,
    setError,
  );
  function stage(build: () => SetupCommand) {
    try {
      setReview(build());
      setError("");
    } catch (e) {
      setError(flowError(e));
    }
  }
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">{t("jobs")}</h3>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <p>{t("jobHint")}</p>
      <Button
        variant="outline"
        disabled={!source.definition.enabled || command.busy || !!command.pending}
        onClick={() =>
          stage(() => automationCommand(scope, source, { ...source.definition, enabled: false }))
        }
      >
        {t("disable")}
      </Button>
      <ul className="space-y-3">
        {source.jobs?.map((job) => (
          <li className="space-y-2 rounded-md border p-3" key={job.id}>
            <p>
              {t(`states.${job.state}`)} · {t("attempts", { count: job.attempts })}
            </p>
            {job.next_attempt_at && (
              <p>
                {f.dateTime(new Date(job.next_attempt_at), {
                  timeZone,
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
            {job.safe_error_code && <FlowError code={job.safe_error_code} />}
            {job.result_reference && (
              <p>
                {t(job.result_reference.type === "outbox_jobs" ? "skipped" : "result")} ·{" "}
                {job.result_reference.type}
              </p>
            )}
            {job.retry_available && job.state === "failed" && !job.result_reference && (
              <Button
                disabled={command.busy || !!command.pending}
                onClick={() =>
                  stage(() => automationCommand(scope, source, source.definition, job))
                }
              >
                {t("retry")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {review && (
        <ConfirmWrite
          key={review.input.operation_key}
          command={review}
          controller={command}
          onBack={() => setReview(null)}
        >
          <p>
            {source.definition.name} ·{" "}
            {t(
              review.operation === "automation_save_v1" && review.input.retry_job
                ? "retry"
                : "disable",
            )}
          </p>
        </ConfirmWrite>
      )}
    </section>
  );
}
