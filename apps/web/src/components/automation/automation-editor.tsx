"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { AutomationDefinition, SegmentCondition } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import {
  automationCommand,
  automationSlot,
  configurationJournalScope,
  type AutomationTarget,
  segmentCommand,
  type AutomationRecord,
  type SegmentRecord,
} from "../../lib/automation-command";
import { SegmentConditions } from "./segment-conditions";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
export function AutomationEditor({
  scope,
  source,
  target = "center",
  segments,
  onSaved,
}: {
  scope: SetupScope;
  source: AutomationRecord | null;
  target?: AutomationTarget;
  segments: SegmentRecord[];
  onSaved: () => void;
}) {
  const t = useTranslations("automation"),
    id = useId(),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const command = useSetupCommand(
    configurationJournalScope(scope, source?.configKind ?? target),
    automationSlot("automation", scope, source?.configKind ?? target, source?.id),
    onSaved,
    setError,
  );
  const [name, setName] = useState(source?.definition.name ?? ""),
    [trigger, setTrigger] = useState<AutomationDefinition["trigger"]["kind"]>(
      source?.definition.trigger.kind ?? "student_inactive",
    ),
    [offset, setOffset] = useState(source?.definition.trigger.offset_days ?? 7),
    [action, setAction] = useState<AutomationDefinition["action"]["kind"]>(
      source?.definition.action.kind ?? "create_followup",
    ),
    [template, setTemplate] = useState(source?.definition.action.template_key ?? "followup"),
    [segment, setSegment] = useState(source?.definition.segment_id ?? ""),
    [enabled, setEnabled] = useState(source?.definition.enabled ?? false);
  const disabled = command.busy || !!command.pending;
  return (
    <section className="space-y-4 rounded-md border p-4" aria-label={t("edit")}>
      <h3 className="font-semibold">{t("edit")}</h3>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <form
        className="space-y-3"
        onChange={() => setReview(null)}
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setReview(
              automationCommand(
                scope,
                source,
                {
                  name,
                  trigger: { kind: trigger, offset_days: offset },
                  action: { kind: action, channel: "in_app", template_key: template },
                  segment_id: segment || null,
                  execution_center_ids: source?.definition.execution_center_ids ?? [
                    scope.centerId!,
                  ],
                  enabled,
                },
                undefined,
                source?.configKind ?? target,
              ),
            );
            setError("");
          } catch (c) {
            setError(flowError(c));
          }
        }}
      >
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={id}>{t("name")}</Label>
            <Input
              id={id}
              value={name}
              required
              maxLength={10000}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-trigger`}>{t("trigger")}</Label>
            <select
              id={`${id}-trigger`}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as typeof trigger)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {["entitlement_expiring", "student_inactive", "lead_followup_due"].map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-offset`}>{t("offset")}</Label>
            <Input
              id={`${id}-offset`}
              type="number"
              min={0}
              max={2147483647}
              required
              value={Number.isFinite(offset) ? offset : ""}
              onChange={(e) => setOffset(e.target.valueAsNumber)}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-action`}>{t("action")}</Label>
            <select
              id={`${id}-action`}
              value={action}
              onChange={(e) => setAction(e.target.value as typeof action)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {["create_followup", "send_reminder"].map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-template`}>{t("template")}</Label>
            <Input
              id={`${id}-template`}
              required
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-segment`}>{t("segment")}</Label>
            <select
              id={`${id}-segment`}
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="">{t("all")}</option>
              {segment && !segments.some((s) => s.id === segment) && (
                <option value={segment}>{t("retainedSegment")}</option>
              )}
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            {t("enabled")}
          </label>
          <Button type="submit">{t("review")}</Button>
        </fieldset>
      </form>
      {review && (
        <ConfirmWrite
          key={review.input.operation_key}
          command={review}
          controller={command}
          onBack={() => setReview(null)}
        >
          <p>
            {name} · {t(trigger)} · {t(action)} · {t(enabled ? "enabled" : "disabled")}
          </p>
          <p>{t("inAppOnly")}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
export function SegmentEditor({
  scope,
  source,
  target = "center",
  onSaved,
}: {
  scope: SetupScope;
  source: SegmentRecord | null;
  target?: AutomationTarget;
  onSaved: () => void;
}) {
  const t = useTranslations("automation"),
    id = useId(),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const command = useSetupCommand(
    configurationJournalScope(scope, source?.configKind ?? target),
    automationSlot("segment", scope, source?.configKind ?? target, source?.id),
    onSaved,
    setError,
  );
  const [name, setName] = useState(source?.name ?? ""),
    [all, setAll] = useState<SegmentCondition[]>(
      source?.definition.all ??
        (source ? [] : [{ field: "active_student", operator: "eq", value: true }]),
    ),
    [any, setAny] = useState<SegmentCondition[]>(source?.definition.any ?? []);
  function invalidate() {
    setReview(null);
    setError("");
  }
  return (
    <section className="space-y-4 rounded-md border p-4">
      <h3 className="font-semibold">{t("segment")}</h3>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <form
        className="space-y-3"
        onChange={invalidate}
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setReview(
              segmentCommand(
                scope,
                source,
                name,
                { all, ...(any.length ? { any } : {}) },
                source?.configKind ?? target,
              ),
            );
          } catch (c) {
            setError(flowError(c));
          }
        }}
      >
        <fieldset disabled={command.busy || !!command.pending} className="space-y-3">
          <Label htmlFor={id}>{t("name")}</Label>
          <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />
          <SegmentConditions
            group="all"
            conditions={all}
            onChange={(v) => {
              invalidate();
              setAll(v);
            }}
          />
          <SegmentConditions
            group="any"
            conditions={any}
            onChange={(v) => {
              invalidate();
              setAny(v);
            }}
          />
          <Button type="submit">{t("review")}</Button>
        </fieldset>
      </form>
      {review && (
        <ConfirmWrite
          key={review.input.operation_key}
          command={review}
          controller={command}
          onBack={() => setReview(null)}
        >
          <p>{name}</p>
          {(
            [
              ["all", all],
              ["any", any],
            ] as const
          ).map(([group, conditions]) => (
            <div key={group}>
              <p>{t(group === "all" ? "matchAll" : "matchAny")}</p>
              {conditions.map((c, i) => (
                <p key={i}>
                  {t(c.field)} · {t(c.operator)} ·{" "}
                  {Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "")}
                </p>
              ))}
            </div>
          ))}
        </ConfirmWrite>
      )}
    </section>
  );
}
