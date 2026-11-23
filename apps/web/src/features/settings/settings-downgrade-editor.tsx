import { useEffect, useRef, useState } from "react";
import type { AccountReadContext } from "../../lib/scoped-backend";
import { useInfiniteQuery, useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { StarterRetainedScope } from "@ftksaas/api-contracts";
import { formatMinorAmount } from "../../lib/money";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { PlanSheet } from "./plan-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import type { SettingsSubscriptionSource } from "./settings-subscription";
import {
  readDowngradeCenters,
  readDowngradeSource,
  settingsDowngradeIntent,
  writeSettingsDowngrade,
  readSettingsDowngradeReceipt,
  readSettingsDowngradeResult,
  type SettingsDowngradeIntent,
  type RetainedKind,
} from "./settings-downgrade";
const kinds: RetainedKind[] = ["rooms", "disciplines", "instructors", "students"];
const blank: StarterRetainedScope = {
  room_id: null,
  discipline_id: null,
  instructor_id: null,
  student_person_ids: [],
};
export function SettingsDowngradeEditor({
  before,
  timezone,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  before: SettingsSubscriptionSource;
  timezone: string;
  onSaved: (result: SettingsSubscriptionSource) => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [targetId, setTarget] = useState<string | null>(null),
    [centerId, setCenter] = useState(""),
    [kept, setKept] = useState<StarterRetainedScope>(structuredClone(blank)),
    [review, setReview] = useState<SettingsDowngradeIntent & { centerName?: string }>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const [pages, setPages] = useState<
    Partial<Record<RetainedKind, { cursors: (string | undefined)[]; index: number }>>
  >({});
  const [names, setNames] = useState<Record<string, string>>({});
  const busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeSettingsDowngrade,
    readReceipt: readSettingsDowngradeReceipt,
    readResult: readSettingsDowngradeResult,
    onRefresh: onSaved,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const target = before.subscription.billing?.downgrade_options?.find(
    (row) => row.target.id === targetId,
  );
  const centers = useInfiniteQuery({
    queryKey: ["downgrade-centers", before.scope],
    queryFn: (context) => readDowngradeCenters(before, context.pageParam, context),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: !!target?.kept_center_required,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const activeCenters = (
    centers.isError ? [] : (centers.data?.pages.flatMap((page) => page.items) ?? [])
  ).filter((center) => center.state === "active");
  const sources = useQueries({
    queries: kinds.map((kind) => ({
      queryKey: [
        "downgrade-resources",
        before.scope,
        before.subscription.subscription_version,
        targetId,
        centerId,
        kind,
        pages[kind],
      ],
      queryFn: (context: AccountReadContext) =>
        readDowngradeSource(
          before,
          targetId!,
          centerId,
          kind,
          pages[kind]?.cursors[pages[kind]!.index],
          context,
        ),
      enabled: target?.plan === "starter" && !!centerId,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  async function prepare() {
    if (!targetId || busy.current || locked) return;
    busy.current = true;
    setPreparing(true);
    setError(false);
    try {
      const intent = await settingsDowngradeIntent(before, targetId, centerId || undefined, kept);
      const centerName = activeCenters.find((center) => center.id === intent.centerId)?.name;
      if (intent.centerId && !centerName) throw Error("SUBSCRIPTION_SOURCE_UNAVAILABLE");
      if (active.current) {
        command.reset();
        setAccepted(false);
        setReview({ ...intent, centerName });
      }
    } catch (cause) {
      if (active.current && !onAccessLost(cause)) setError(true);
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={t(($) => $.settings.downgrade.title)}
        description={t(($) => $.settings.downgrade.hint)}
        rows={[
          {
            id: "plan",
            title: t(($) => $.settings.changePlan),
            detail: `${review.target.plan} · ${formatMinorAmount(review.target.target.amount_minor, review.target.target.currency)} · ${t(($) => $.settings.subscriptionPeriods[review.target.target.period])}`,
          },
          {
            id: "date",
            title: t(($) => $.settings.downgrade.effective),
            detail: date(review.target.effective_at),
          },
          ...(review.centerName
            ? [
                {
                  id: "center",
                  title: t(($) => $.settings.downgrade.center),
                  detail: review.centerName,
                },
              ]
            : []),
          ...(review.kept
            ? [
                {
                  id: "scope",
                  title: t(($) => $.settings.downgrade.retained),
                  detail: t(($) => $.settings.downgrade.selection, {
                    room:
                      (review.kept.room_id ? names[review.kept.room_id] : undefined) ??
                      t(($) => $.settings.downgrade.none),
                    discipline:
                      (review.kept.discipline_id ? names[review.kept.discipline_id] : undefined) ??
                      t(($) => $.settings.downgrade.none),
                    instructor:
                      (review.kept.instructor_id ? names[review.kept.instructor_id] : undefined) ??
                      t(($) => $.settings.downgrade.none),
                    students: review.kept.student_person_ids.length,
                  }),
                },
              ]
            : []),
        ]}
        accepted={accepted}
        onAccepted={setAccepted}
        onApply={
          !command.unavailable && command.state === "ready"
            ? () => {
                if (accepted && !locked) void command.start(review);
              }
            : undefined
        }
        onClose={() => {
          if (!locked) {
            setReview(undefined);
            setAccepted(false);
          }
        }}
        locked={locked}
        recoveryActions={
          <EventCommandNotice
            command={command}
            onReload={() => {
              if (!locked) {
                command.reset();
                setReview(undefined);
                setAccepted(false);
              }
            }}
          />
        }
      />
    );
  return (
    <PlanSheet
      open
      title={t(($) => $.settings.downgrade.title)}
      description={t(($) => $.settings.downgrade.hint)}
      options={
        before.subscription.billing?.downgrade_options?.map((row) => ({
          key: row.target.id,
          label: t(($) => $.settings.subscriptionPlans[row.plan]),
          description: `${formatMinorAmount(row.target.amount_minor, row.target.currency)} · ${t(($) => $.settings.subscriptionPeriods[row.target.period])} · ${date(row.effective_at)}`,
        })) ?? null
      }
      selected={targetId}
      onSelect={(value) => {
        if (!locked) {
          setTarget(value);
          setCenter("");
          setKept(structuredClone(blank));
          setNames({});
          setPages({});
        }
      }}
      effects={
        target &&
        (!target.kept_center_required || centerId) &&
        (target.plan !== "starter" ||
          sources.every((source) => source.isSuccess && !source.isFetching))
          ? [
              {
                id: "date",
                title: t(($) => $.settings.downgrade.effective),
                detail: date(target.effective_at),
              },
            ]
          : null
      }
      locked={locked}
      onReview={() => void prepare()}
      onClose={onClose}
      error={error ? t(($) => $.settings.subscriptionReadError) : undefined}
      recoveryActions={
        <div className="space-y-4">
          {target?.kept_center_required && (
            <Field>
              <FieldLabel htmlFor="downgrade-center">
                {t(($) => $.settings.downgrade.center)}
              </FieldLabel>
              <NativeSelect
                id="downgrade-center"
                value={centerId}
                disabled={locked || centers.isError}
                onChange={(event) => {
                  setCenter(event.target.value);
                  setKept(structuredClone(blank));
                  setNames({});
                  setPages({});
                }}
              >
                <NativeSelectOption value="">
                  {t(($) => $.settings.downgrade.choose)}
                </NativeSelectOption>
                {activeCenters.map((center) => (
                  <NativeSelectOption key={center.id} value={center.id}>
                    {center.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {centers.hasNextPage && (
                <Button
                  variant="outline"
                  isDisabled={locked || centers.isFetchingNextPage}
                  onPress={() => void centers.fetchNextPage()}
                >
                  {t(($) => $.settings.downgrade.moreCenters)}
                </Button>
              )}
            </Field>
          )}
          {target?.plan === "starter" &&
            centerId &&
            kinds.map((kind, index) => {
              const source = sources[index]!,
                position = pages[kind]?.index ?? 0;
              const resources = !source.isError
                ? (source.data?.items.flatMap((row) =>
                    row.retained_resource ? [row.retained_resource] : [],
                  ) ?? [])
                : [];
              const key =
                kind === "rooms"
                  ? "room_id"
                  : kind === "disciplines"
                    ? "discipline_id"
                    : "instructor_id";
              return (
                <div key={kind} className="space-y-2">
                  <h3 className="text-sm font-medium">
                    {t(($) => $.settings.downgrade.resources[kind])}
                  </h3>
                  {source.isError ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {t(($) => $.settings.subscriptionReadError)}
                        <Button variant="outline" onPress={() => void source.refetch()}>
                          {t(($) => $.auth.retry)}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : kind === "students" ? (
                    <div className="space-y-2">
                      {resources.map((row) => (
                        <Checkbox
                          key={row.id}
                          isDisabled={locked}
                          isSelected={kept.student_person_ids.includes(row.id)}
                          onChange={(value) =>
                            setKept((previous) => ({
                              ...previous,
                              student_person_ids: value
                                ? [...previous.student_person_ids, row.id]
                                : previous.student_person_ids.filter((id) => id !== row.id),
                            }))
                          }
                        >
                          {row.display_name}
                          {row.subscriber_number ? ` · ${row.subscriber_number}` : ""}
                        </Checkbox>
                      ))}
                    </div>
                  ) : (
                    <NativeSelect
                      aria-label={t(($) => $.settings.downgrade.resources[kind])}
                      value={kept[key] ?? ""}
                      disabled={locked || source.isPending}
                      onChange={(event) => {
                        const value = event.target.value;
                        const selected = resources.find((row) => row.id === value);
                        if (selected)
                          setNames((previous) => ({ ...previous, [value]: selected.display_name }));
                        setKept((previous) => ({ ...previous, [key]: value || null }));
                      }}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.settings.downgrade.none)}
                      </NativeSelectOption>
                      {kept[key] && !resources.some((row) => row.id === kept[key]) && (
                        <NativeSelectOption value={kept[key]!}>
                          {names[kept[key]!] ?? kept[key]}
                        </NativeSelectOption>
                      )}
                      {resources.map((row) => (
                        <NativeSelectOption key={row.id} value={row.id}>
                          {row.display_name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {kind === "students"
                      ? t(($) => $.settings.downgrade.studentCount, {
                          count: kept.student_person_ids.length,
                        })
                      : kept[key]
                        ? (names[kept[key]!] ?? kept[key])
                        : t(($) => $.settings.downgrade.none)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={locked || position === 0 || source.isFetching}
                      onPress={() =>
                        setPages((previous) => ({
                          ...previous,
                          [kind]: { cursors: previous[kind]!.cursors, index: position - 1 },
                        }))
                      }
                    >
                      {t(($) => $.earnings.previousPage)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={locked || !source.data?.next_cursor || source.isFetching}
                      onPress={() => {
                        const next = source.data?.next_cursor;
                        if (next)
                          setPages((previous) => ({
                            ...previous,
                            [kind]: {
                              cursors: [
                                ...(previous[kind]?.cursors ?? [undefined]).slice(0, position + 1),
                                next,
                              ],
                              index: position + 1,
                            },
                          }));
                      }}
                    >
                      {t(($) => $.earnings.nextPage)}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>
      }
    />
  );
}
