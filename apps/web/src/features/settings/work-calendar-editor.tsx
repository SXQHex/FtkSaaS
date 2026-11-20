import { ZodError } from "zod";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { WorkCalendarSheet, type WorkCalendarDraft } from "./work-calendar-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import {
  workCalendarDays,
  readWorkCalendar,
  prepareWorkCalendar,
  writeWorkCalendar,
  readWorkCalendarReceipt,
  readWorkCalendarResult,
  type WorkCalendarIntent,
} from "./work-calendar";
export function WorkCalendarEditor({
  scope,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient();
  const [draftOverride, setDraft] = useState<WorkCalendarDraft | undefined>(undefined),
    [review, setReview] = useState<WorkCalendarIntent>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const lastEnabled = useRef<Exclude<WorkCalendarDraft, null> | undefined>(undefined),
    active = useRef(true),
    preparingRef = useRef(false),
    errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const key = ["work-calendar", scope.accountId, scope.orgId, scope.centerId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => readWorkCalendar(scope),
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const draft = draftOverride !== undefined ? draftOverride : (query.data?.calendar ?? null);
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);
  const command = useMemberCommand({
    write: writeWorkCalendar,
    readReceipt: readWorkCalendarReceipt,
    readResult: readWorkCalendarResult,
    onAccessLost,
    onRefresh: async (source) => {
      queries.setQueryData(key, source);
      await Promise.all(
        ["settings-document", "settings-history", "schedule-sources", "studio"].map((group) =>
          queries.invalidateQueries({
            queryKey: [group, scope.accountId, scope.orgId],
            refetchType: "none",
          }),
        ),
      );
    },
  });
  const locked = preparing || command.locked,
    readable = !!query.data && !query.isError && !query.isFetching;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function change(value: WorkCalendarDraft) {
    if (locked || review) return;
    setError(undefined);
    setReview(undefined);
    setAccepted(false);
    if (draft && value === null) lastEnabled.current = draft;
    setDraft(value);
    if (value) lastEnabled.current = value;
  }
  async function prepare() {
    if (preparingRef.current || locked || !readable || !query.data || command.state !== "ready")
      return;
    preparingRef.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await prepareWorkCalendar(query.data, draft);
      if (active.current) {
        setReview(intent);
        setAccepted(false);
      }
    } catch (cause) {
      if (active.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError && cause.code === "OPEN_OPERATIONS_EXIST"
            ? t(($) => $.workCalendar.blocked)
            : cause instanceof BackendError && cause.code === "VERSION_CONFLICT"
              ? t(($) => $.workCalendar.stale)
              : cause instanceof ZodError ||
                  cause instanceof RangeError ||
                  (cause instanceof Error && cause.message === "WORK_CALENDAR_UNCHANGED")
                ? t(($) => $.workCalendar.invalid)
                : t(($) => $.settings.unavailable),
        );
    } finally {
      preparingRef.current = false;
      if (active.current) setPreparing(false);
    }
  }
  function ruleSummary(row: Exclude<WorkCalendarDraft, null>["rules"][number]) {
    const dayLabels = row.weekdays
      .map((day) => workCalendarDays[day - 1])
      .filter((day) => day !== undefined)
      .map((day) => t(($) => $.studio.days[day]));
    const date = (value: string) => value.split("-").reverse().join(".");
    return `${dayLabels.join(", ")}: ${row.local_start}–${row.local_end}; ${date(row.valid_from)} → ${row.valid_until ? date(row.valid_until) : t(($) => $.workCalendar.openEnded)}`;
  }
  function reload() {
    if (!locked) {
      command.reset();
      setDraft(undefined);
      lastEnabled.current = undefined;
      setError(undefined);
      setReview(undefined);
      setAccepted(false);
      void query.refetch();
    }
  }
  return (
    <>
      <WorkCalendarSheet
        value={draft}
        timezone={query.data?.timezone}
        disabled={locked}
        known={readable}
        editable={readable && !!query.data?.writable && command.state === "ready" && !review}
        onValue={change}
        onEnabled={(enabled) =>
          change(
            enabled
              ? structuredClone(
                  lastEnabled.current ?? query.data?.calendar ?? { rules: [], closures: [] },
                )
              : null,
          )
        }
        onReview={() => void prepare()}
        onClose={onClose}
        notice={
          <>
            {!readable && !query.isError && <p role="status">{t(($) => $.settings.unread)}</p>}
            {query.isError && (
              <Alert role="alert" variant="destructive">
                <AlertDescription>
                  {t(($) => $.settings.unavailable)}{" "}
                  <Button type="button" variant="outline" onPress={reload}>
                    {t(($) => $.profile.loadCurrent)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert role="alert" variant="destructive">
                <AlertDescription>
                  <div ref={errorSummary} tabIndex={-1}>
                    {error}
                  </div>
                  <Button type="button" variant="outline" onPress={reload}>
                    {t(($) => $.profile.loadCurrent)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <EventCommandNotice command={command} onReload={reload} />
          </>
        }
      />
      <SettingsReviewDialog
        open={!!review}
        title={t(($) => $.workCalendar.review)}
        description={t(($) => $.workCalendar.description)}
        rows={
          review
            ? [
                {
                  id: "calendar",
                  title: query.data?.timezone ?? "",
                  detail: t(($) => $.workCalendar.summary, {
                    before: review.before.calendar?.rules.length ?? 0,
                    after: review.calendar?.rules.length ?? 0,
                    closuresBefore: review.before.calendar?.closures.length ?? 0,
                    closuresAfter: review.calendar?.closures.length ?? 0,
                  }),
                },
                ...(review.before.calendar?.rules ?? []).map((row, index) => ({
                  id: `before-${index}`,
                  title: t(($) => $.workCalendar.before),
                  detail: ruleSummary(row),
                })),
                ...(review.calendar?.rules ?? []).map((row, index) => ({
                  id: `after-${index}`,
                  title: t(($) => $.workCalendar.after),
                  detail: ruleSummary(row),
                })),
                {
                  id: "mode",
                  title: t(($) => $.workCalendar.enabled),
                  detail:
                    review.calendar === null
                      ? t(($) => $.workCalendar.noRestriction)
                      : t(($) => $.workCalendar.enabled),
                },
              ]
            : null
        }
        accepted={accepted}
        locked={locked}
        onAccepted={setAccepted}
        onClose={() => {
          if (!locked) {
            setReview(undefined);
            setAccepted(false);
          }
        }}
        onApply={
          review && accepted && command.state === "ready"
            ? () => void command.start(review)
            : undefined
        }
        recoveryActions={<EventCommandNotice command={command} onReload={reload} />}
      />
    </>
  );
}
