import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { AutomationSheet } from "./automation-sheet";
import { SegmentSheet } from "./segment-sheet";
import {
  automationDraft,
  automationDefinition,
  segmentDraft,
  segmentDefinition,
} from "./automation-form";
import {
  automationIntent,
  segmentIntent,
  writeAutomation,
  readAutomationReceipt,
  readAutomationResult,
  readSegments,
  readAutomationPreparations,
  resolveAutomationPreparation,
  type AutomationRecord,
  type SegmentRecord,
} from "./automation";
import type { AutomationDraft, SegmentDraft } from "./automation-draft";
export interface AutomationEditorProps {
  scope: ClientScope;
  selection:
    | { kind: "automation"; before?: AutomationRecord }
    | { kind: "segment"; before?: SegmentRecord };
  ownPersonId?: string;
  centerName: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}
export function AutomationEditor(props: AutomationEditorProps) {
  const { t } = useTranslation(),
    { scope, selection, onAccessLost, onLockChange } = props;
  const [auto, setAuto] = useState<AutomationDraft>(() =>
      automationDraft(selection.kind === "automation" ? selection.before : undefined),
    ),
    [segment, setSegment] = useState<SegmentDraft>(
      () =>
        (selection.kind === "segment" ? segmentDraft(selection.before) : undefined) ?? {
          name: "",
          conditions: [],
        },
    ),
    [reviewed, setReviewed] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>(),
    [nameError, setNameError] = useState<string>(),
    [preset, setPreset] = useState(""),
    [prepared, setPrepared] = useState<Awaited<ReturnType<typeof resolveAutomationPreparation>>>();
  const queries = useQueryClient();
  const running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeAutomation,
    readReceipt: readAutomationReceipt,
    readResult: readAutomationResult,
    onRefresh: async () => {
      await props.onSaved();
    },
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const choices = useInfiniteQuery({
    queryKey: ["automation-segment-choices", scope.accountId, scope.orgId, scope.centerId],
    queryFn: async (context) => {
      const page = await readSegments(scope, undefined, context.pageParam, context);
      const prior = queries.getQueryData<{ pageParams: (string | undefined)[] }>([
        "automation-segment-choices",
        scope.accountId,
        scope.orgId,
        scope.centerId,
      ]);
      if (
        page.next_cursor &&
        (page.next_cursor === context.pageParam || prior?.pageParams.includes(page.next_cursor))
      )
        throw Error("AUTOMATION_CURSOR_UNAVAILABLE");
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: selection.kind === "automation",
    retry: false,
  });
  const templates = useQuery({
    queryKey: ["automation-preparations", scope.accountId, scope.orgId, scope.centerId],
    queryFn: (context) => readAutomationPreparations(scope, context),
    enabled: selection.kind === "automation",
    retry: false,
  });
  useEffect(() => {
    for (const cause of [choices.error, templates.error]) if (cause) onAccessLost(cause);
  }, [choices.error, templates.error, onAccessLost]);
  function failure(cause: unknown) {
    if (!mounted.current || onAccessLost(cause)) return;
    setError(
      cause instanceof BackendError
        ? scheduleBackendError(cause.code, t)
        : t(($) => $.automation.invalid),
    );
  }
  async function save() {
    if (running.current || locked || command.state !== "ready") return;
    const name = selection.kind === "automation" ? auto.name : segment.name;
    if (!name.trim()) {
      setNameError(t(($) => $.automation.invalidName));
      return;
    }
    if (!reviewed) {
      setError(t(($) => $.automation.reviewRequired));
      return;
    }
    running.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent =
        selection.kind === "automation"
          ? await automationIntent(
              scope,
              automationDefinition(
                scope,
                auto,
                selection.before,
                prepared?.defaults.action.kind === "send_reminder"
                  ? prepared.defaults.action.template_key
                  : undefined,
              ),
              reviewed,
              selection.before,
            )
          : await segmentIntent(
              scope,
              segment.name,
              segmentDefinition(segment, selection.before),
              reviewed,
              selection.before,
            );
      if (mounted.current) await command.start(intent);
    } catch (cause) {
      failure(cause);
    } finally {
      running.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  async function choosePreset(key: string) {
    if (running.current || locked) return;
    setPreset(key);
    setPrepared(undefined);
    setReviewed(false);
    if (!key) return;
    const row = templates.data?.find(
      (value) => `${value.source.scope}:${value.source.key}` === key,
    );
    if (!row) return;
    running.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const result = await resolveAutomationPreparation(scope, row.source);
      if (!mounted.current) return;
      setPrepared(result);
      setAuto((value) => ({
        ...value,
        trigger: result.defaults.trigger.kind,
        offsetDays: String(result.defaults.trigger.offset_days),
        action: result.defaults.action.kind === "create_followup" ? "followup" : "inbox",
        text:
          result.defaults.action.kind === "create_followup"
            ? result.defaults.action.template_key
            : "",
        template:
          result.defaults.action.kind === "send_reminder"
            ? result.defaults.action.template_key
            : "",
        recipients: [...(result.defaults.trigger.recipient_person_ids ?? [])],
      }));
    } catch (cause) {
      failure(cause);
    } finally {
      running.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const notice = (
    <>
      <EventCommandNotice command={command} onReload={props.onClose} />
      <Alert>
        <AlertDescription>{t(($) => $.automation.nativeLimit)}</AlertDescription>
      </Alert>
    </>
  );
  if (selection.kind === "segment")
    return (
      <SegmentSheet
        draft={segment}
        onDraft={(value) => {
          if (!locked) {
            setSegment(value);
            setNameError(undefined);
            setError(undefined);
          }
        }}
        editing={!!selection.before}
        supported={["remaining"]}
        match={<p>{t(($) => $.automation.matchUnknown)}</p>}
        notice={notice}
        error={error}
        nameError={nameError}
        reviewed={reviewed}
        onReviewed={setReviewed}
        onClose={props.onClose}
        onSave={() => {
          void save();
        }}
        locked={locked}
        readOnly={command.state !== "ready"}
      />
    );
  const workAlert = ["pending_request", "unclosed_attendance"].includes(auto.trigger);
  const segments = choices.data?.pages.flatMap((page) => page.items) ?? [];
  const options = segments
    .filter((row) => row.state === "active")
    .map((row) => ({ id: row.id, name: row.name, disabled: workAlert }));
  if (
    selection.before?.definition.segment_id &&
    !options.some((row) => row.id === selection.before!.definition.segment_id)
  )
    options.push({
      id: selection.before.definition.segment_id,
      name: t(($) => $.automation.existingSegment),
      disabled: workAlert,
    });
  const recipientIds = [
    ...new Set([
      ...(props.ownPersonId ? [props.ownPersonId] : []),
      ...(selection.before?.definition.trigger.recipient_person_ids ?? []),
      ...auto.recipients,
    ]),
  ];
  return (
    <AutomationSheet
      nativeMode
      workAlert={workAlert}
      draft={auto}
      onDraft={(value) => {
        if (!locked) {
          if (value.action !== auto.action) {
            value = { ...value, text: "", template: "" };
            setPrepared(undefined);
            setPreset("");
          }
          if (
            value.trigger !== auto.trigger &&
            !["pending_request", "unclosed_attendance"].includes(value.trigger)
          )
            value = { ...value, recipients: [] };
          setAuto(value);
          setNameError(undefined);
          setError(undefined);
        }
      }}
      editing={!!selection.before}
      segments={options}
      triggers={(
        [
          "entitlement_expiring",
          "student_inactive",
          "lead_followup_due",
          "pending_request",
          "unclosed_attendance",
        ] as const
      ).map((kind) => ({ id: kind, name: t(($) => $.automation.triggers[kind]) }))}
      templates={[]}
      assignees={[]}
      recipients={(workAlert ? recipientIds : []).map((id, index) => ({
        id,
        name:
          id === props.ownPersonId
            ? t(($) => $.automation.me)
            : t(($) => $.automation.existingRecipient, { count: index + 1 }),
        disabled: id !== props.ownPersonId,
      }))}
      preparationPicker={
        <>
          <Field>
            <FieldLabel htmlFor="automation-preparation">
              {t(($) => $.automation.preparation)}
            </FieldLabel>
            <NativeSelect
              id="automation-preparation"
              value={preset}
              disabled={locked || templates.isFetching || templates.isError}
              onChange={(event) => {
                void choosePreset(event.target.value);
              }}
            >
              <NativeSelectOption value="">{t(($) => $.automation.choose)}</NativeSelectOption>
              {templates.data?.map((row) => (
                <NativeSelectOption
                  key={`${row.source.scope}:${row.source.key}`}
                  value={`${row.source.scope}:${row.source.key}`}
                >
                  {row.template.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>{t(($) => $.automation.preparationHint)}</FieldDescription>
          </Field>
          {templates.isError && (
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => {
                void templates.refetch();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          )}
          {choices.hasNextPage && (
            <Button
              variant="outline"
              isDisabled={locked || choices.isFetching}
              onPress={() => {
                void choices.fetchNextPage();
              }}
            >
              {t(($) => $.automation.moreSegments)}
            </Button>
          )}
          {choices.isError && (
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => {
                void choices.refetch();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          )}
        </>
      }
      effect={
        <div className="flex flex-col gap-2 text-sm">
          <p>{props.centerName}</p>
          <p>
            {auto.action === "followup"
              ? t(($) => $.automation.followupHint)
              : t(($) => $.automation.inAppHint)}
          </p>
          <p>{t(($) => $.automation.noWorker)}</p>
        </div>
      }
      notice={notice}
      error={error}
      nameError={nameError}
      onSave={() => {
        void save();
      }}
      onClose={props.onClose}
      reviewed={reviewed}
      onReviewed={setReviewed}
      locked={locked}
      readOnly={command.state !== "ready"}
    />
  );
}
