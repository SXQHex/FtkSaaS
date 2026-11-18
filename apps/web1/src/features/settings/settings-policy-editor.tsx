import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { PolicyView } from "../../lib/api-contracts/generated";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { PolicySheet, type PolicyChoiceField } from "./policy-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import type { SettingsLevel } from "./settings-document";
import {
  parseEditablePolicy,
  previewSettingsPolicy,
  settingsPolicyIntent,
  writeSettingsPolicy,
  readSettingsPolicyReceipt,
  readSettingsPolicyResult,
  type SettingsPolicyReview,
} from "./settings-policy-command";
export function SettingsPolicyEditor({
  scope,
  level,
  before,
  timezone,
  disciplines,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  level: SettingsLevel;
  before: PolicyView;
  timezone: string;
  disciplines: { id: string; name: string }[];
  onSaved: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const initial: Record<string, string> = {};
  if (before.value.kind !== "documents") {
    for (const [key, value] of Object.entries(before.value)) {
      if (key === "kind") continue;
      if (key === "terms" && typeof value === "object" && value) {
        for (const [part, entry] of Object.entries(value)) {
          if (entry === null) initial[part] = "";
          else if (
            typeof entry === "string" ||
            typeof entry === "number" ||
            typeof entry === "boolean"
          )
            initial[part] = String(entry);
        }
      } else if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      )
        initial[key] = String(value);
    }
  }
  const [draft, setDraft] = useState(initial),
    [time, setTime] = useState(""),
    [reason, setReason] = useState(""),
    [mandatory, setMandatory] = useState(level === "organization" && before.mandatory),
    [review, setReview] = useState<SettingsPolicyReview>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const executing = useRef(false),
    mounted = useRef(true),
    intent = useRef<ReturnType<typeof settingsPolicyIntent> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeSettingsPolicy,
    readReceipt: readSettingsPolicyReceipt,
    readResult: readSettingsPolicyResult,
    onAccessLost,
    onRefresh: async () => onSaved(),
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const options = (values: string[]) =>
    values.map((value) => ({
      value,
      label:
        value === "true"
          ? t(($) => $.settings.on)
          : value === "false"
            ? t(($) => $.settings.off)
            : value === "release"
              ? t(($) => $.settings.policyNative.release)
              : value === "consume"
                ? t(($) => $.settings.policyNative.consume)
                : t(($) => $.settings.policyNative.formats[value as "group" | "private"]),
    }));
  const fields: PolicyChoiceField[] = Object.keys(initial).map((key) => ({
    key,
    label: t(
      ($) =>
        $.settings.policyNative.fields[
          key as keyof (typeof import("../../locales/tr/common.json"))["settings"]["policyNative"]["fields"]
        ],
    ),
    value: draft[key] ?? "",
    writable: true,
    options:
      (["value", "manager_exception"].includes(key) && before.value.kind === "boolean") ||
      key === "manager_exception"
        ? options(["true", "false"])
        : ["effect", "before_cutoff", "after_cutoff", "no_show"].includes(key)
          ? options(["release", "consume"])
          : key === "format"
            ? options(["group", "private"])
            : key === "discipline_id"
              ? disciplines.map((row) => ({ value: row.id, label: row.name }))
              : [],
    ...(!(
      [
        "effect",
        "before_cutoff",
        "after_cutoff",
        "no_show",
        "format",
        "discipline_id",
        "manager_exception",
      ].includes(key) ||
      (key === "value" && before.value.kind === "boolean")
    )
      ? {
          input: {
            type: ["amount_minor", "currency"].includes(key)
              ? ("text" as const)
              : ("number" as const),
            min: 0,
            step: 1,
          },
        }
      : {}),
  }));
  fields.push(
    {
      key: "effective",
      label: t(($) => $.settings.policyNative.effective),
      value: time,
      writable: true,
      options: [],
      input: { type: "datetime-local", step: 1 },
    },
    {
      key: "reason",
      label: t(($) => $.settings.policyNative.reason),
      value: reason,
      writable: true,
      options: [],
      input: { type: "text" },
    },
  );
  if (level === "organization")
    fields.push({
      key: "mandatory",
      label: t(($) => $.settings.policyNative.mandatory),
      value: String(mandatory),
      writable: true,
      options: options(["true", "false"]),
    });
  async function prepare() {
    if (locked || executing.current || before.value.kind === "documents") return;
    executing.current = true;
    setPreparing(true);
    setError(false);
    try {
      const raw: Record<string, unknown> = { kind: before.value.kind };
      const values: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(draft))
        values[key] =
          ["manager_exception"].includes(key) ||
          (key === "value" && before.value.kind === "boolean")
            ? value === "true"
            : ["value", "opens_minutes_before", "closes_minutes_before", "cutoff_minutes"].includes(
                  key,
                )
              ? key === "cutoff_minutes" && value === ""
                ? null
                : /^(0|[1-9][0-9]*)$/.test(value)
                  ? Number(value)
                  : NaN
              : value;
      if (before.value.kind === "cancellation") raw.terms = values;
      else Object.assign(raw, values);
      const result = await previewSettingsPolicy(
        scope,
        level,
        before,
        parseEditablePolicy(raw),
        time,
        timezone,
        mandatory,
        reason,
      );
      if (mounted.current) {
        command.reset();
        intent.current = undefined;
        setReview(result);
        setAccepted(false);
      }
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) setError(true);
    } finally {
      executing.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const title = t(($) => $.settings.nativePolicies.keys[before.key]);
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={title}
        description={t(($) => $.settings.policyNative.review)}
        rows={[
          ...Object.entries(draft).map(([key, value]) => ({
            id: key,
            title: t(
              ($) =>
                $.settings.policyNative.fields[
                  key as keyof (typeof import("../../locales/tr/common.json"))["settings"]["policyNative"]["fields"]
                ],
            ),
            detail:
              key === "discipline_id"
                ? (disciplines.find((row) => row.id === value)?.name ?? value)
                : value,
          })),
          {
            id: "time",
            title: t(($) => $.settings.policyNative.effective),
            detail: `${review.change.effective_at} · ${timezone}`,
          },
          {
            id: "affected",
            title: t(($) => $.settings.policyNative.protected, { count: review.ids.length }),
            detail: review.ids.join(" · ") || t(($) => $.settings.policyNative.none),
          },
        ]}
        blockers={review.preview.preview.blockers.map((row, index) => ({
          id: String(index),
          text: row.code,
        }))}
        accepted={accepted}
        onAccepted={setAccepted}
        locked={locked}
        onClose={() => {
          if (!locked) {
            if (command.state === "ready") {
              setReview(undefined);
              setAccepted(false);
            } else onClose();
          }
        }}
        onApply={
          command.state === "ready" && !command.unavailable
            ? () => {
                if (!accepted || locked) return;
                try {
                  intent.current ??= settingsPolicyIntent(review);
                  void command.start(intent.current);
                } catch {
                  setError(true);
                }
              }
            : undefined
        }
        notice={error ? t(($) => $.settings.policyNative.error) : undefined}
        recoveryActions={
          <EventCommandNotice
            command={command}
            onReload={() => {
              if (!locked) {
                command.reset();
                intent.current = undefined;
                setReview(undefined);
                setAccepted(false);
              }
            }}
          />
        }
      />
    );
  return (
    <PolicySheet
      open
      title={title}
      description={t(($) => $.settings.policyNative.hint, { timezone })}
      fields={fields}
      changes={null}
      history={[
        {
          id: String(before.version),
          title: t(($) => $.settings.policyNative.version, { version: before.version }),
          detail: before.effective_at,
        },
      ]}
      dirty={true}
      locked={locked}
      onField={(key, value) => {
        if (locked) return;
        setError(false);
        if (key === "effective") setTime(value);
        else if (key === "reason") setReason(value);
        else if (key === "mandatory") setMandatory(value === "true");
        else setDraft((previous) => ({ ...previous, [key]: value }));
      }}
      onReview={() => void prepare()}
      onClose={onClose}
      error={error ? t(($) => $.settings.policyNative.error) : undefined}
    />
  );
}
