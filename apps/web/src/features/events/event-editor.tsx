import { useEffect, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { EventView } from "@ftksaas/api-contracts";
import { useMemberCommand } from "../member-profile/use-member-command";
import { ScheduleTimeError } from "../schedule/schedule-time";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
import { EventSheet } from "./event-sheet";
import { EventCommandNotice } from "./event-command-notice";
import { PreparationPicker } from "../settings/preparation-picker";
import {
  readEvent,
  readEventRooms,
  readEventDisciplines,
  readEventPeople,
  readEventProducts,
} from "./events-read";
import {
  eventDraft,
  eventTermsDraft,
  eventSaveIntent,
  writeEventIntent,
  readEventReceipt,
  readEventResult,
} from "./event-command";
import { emptyEventDraft, type EventDraft } from "./event-draft";
import type { EventChoice } from "./event-terms-fields";

interface Props {
  scope: ClientScope;
  target: string | null;
  timezone: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}
export function EventEditor(props: Props) {
  const { t } = useTranslation();
  const { onAccessLost } = props;
  const source = useQuery({
    queryKey: [
      "event-edit",
      props.scope.accountId,
      props.scope.orgId,
      props.scope.centerId,
      props.target,
    ],
    enabled: !!props.target,
    queryFn: async () => {
      const before = await readEvent(props.scope, props.target!);
      return { before, draft: await eventDraft(before) };
    },
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (source.error) onAccessLost(source.error);
  }, [source.error, onAccessLost]);
  if (props.target && (source.isError || !source.isFetchedAfterMount || !source.data))
    return (
      <EventSheet
        draft={{ ...emptyEventDraft, timezone: props.timezone }}
        onDraft={() => {
          void source.refetch();
        }}
        onSubmit={props.onClose}
        onClose={props.onClose}
        rooms={[]}
        products={[]}
        people={[]}
        disciplines={[]}
        readOnly
        editing
        notice={
          source.isFetching || source.isPending ? (
            <Skeleton className="h-40" />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.events.sourceError)}{" "}
                <Button
                  variant="outline"
                  onPress={() => {
                    void source.refetch();
                  }}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )
        }
      />
    );
  return (
    <EventEditorForm
      {...props}
      initial={source.data?.before}
      initialDraft={props.target ? source.data?.draft : undefined}
    />
  );
}
function EventEditorForm({
  scope,
  initial,
  initialDraft,
  timezone,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: Props & { initial?: EventView; initialDraft?: EventDraft }) {
  const { t } = useTranslation();
  const [before, setBefore] = useState(initial),
    [draft, setDraft] = useState(initialDraft ?? { ...emptyEventDraft, timezone }),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const [startOffsets, setStartOffsets] = useState<EventChoice[]>([]),
    [endOffsets, setEndOffsets] = useState<EventChoice[]>([]);
  const prefix = ["event-choices", scope.accountId, scope.orgId, scope.centerId];
  const rooms = useQuery({
    queryKey: [...prefix, "rooms"],
    queryFn: () => readEventRooms(scope),
    retry: false,
  });
  const people = useQuery({
    queryKey: [...prefix, "people"],
    queryFn: () => readEventPeople(scope),
    retry: false,
  });
  const disciplines = useQuery({
    queryKey: [...prefix, "disciplines"],
    queryFn: () => readEventDisciplines(scope),
    retry: false,
  });
  const products = useInfiniteQuery({
    queryKey: [...prefix, "products"],
    queryFn: ({ pageParam }) => readEventProducts(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
  });
  const command = useMemberCommand({
    write: writeEventIntent,
    readReceipt: readEventReceipt,
    readResult: readEventResult,
    onAccessLost,
    onRefresh: async (result) => {
      setBefore(result);
      await onSaved();
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const sourceError of [rooms.error, people.error, disciplines.error, products.error])
      if (sourceError) onAccessLost(sourceError);
  }, [rooms.error, people.error, disciplines.error, products.error, onAccessLost]);
  function failure(cause: unknown) {
    if (onAccessLost(cause)) return;
    if (cause instanceof ScheduleTimeError) {
      for (const row of cause.requests) {
        const choices = row.choices.map((choice) => ({ id: choice.id, name: choice.label }));
        if (row.date === "starts") setStartOffsets(choices);
        else setEndOffsets(choices);
      }
      setError(
        cause.message === "SCHEDULE_TIME_GAP"
          ? t(($) => $.events.timeGap)
          : t(($) => $.events.timeAmbiguous),
      );
    } else
      setError(
        cause instanceof BackendError && cause.code === "VERSION_CONFLICT"
          ? t(($) => $.events.commandStates.stale)
          : t(($) => $.events.invalid),
      );
  }
  async function reload() {
    if (locked) return;
    setPreparing(true);
    setError(undefined);
    try {
      const current = before ? await readEvent(scope, before.id) : undefined;
      setBefore(current);
      setDraft(await eventDraft(current, timezone));
      setStartOffsets([]);
      setEndOffsets([]);
      command.reset();
      await onSaved();
    } catch (cause) {
      failure(cause);
    } finally {
      setPreparing(false);
    }
  }
  async function submit() {
    if (locked || command.state !== "ready") return;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await eventSaveIntent(scope, draft, before);
      await command.start(intent);
    } catch (cause) {
      failure(cause);
    } finally {
      setPreparing(false);
    }
  }
  const productChoices =
    products.data?.pages.flatMap((page) =>
      page.items.map((row) => ({ id: row.version_id, name: row.terms.name })),
    ) ?? [];
  for (const id of before?.terms.allowed_product_version_ids ?? [])
    if (!productChoices.some((row) => row.id === id))
      productChoices.push({ id, name: t(($) => $.events.existingProduct) });
  const roomChoices = [...(rooms.data ?? [])];
  if (
    before?.venue.kind === "internal" &&
    before.venue.room_id &&
    !roomChoices.some((row) => row.id === before.venue.room_id)
  )
    roomChoices.push({
      id: before.venue.room_id,
      name: t(($) => $.events.existingRoom),
      capacity: null,
    });
  const personChoices = [...(people.data ?? [])];
  for (const row of before?.assignments ?? [])
    if (!personChoices.some((person) => person.id === row.person_id))
      personChoices.push({ id: row.person_id, name: t(($) => $.events.existingPerson) });
  const disciplineChoices = (disciplines.data ?? []).map((row) => ({ id: row.id, name: row.name }));
  for (const id of before?.discipline_ids ?? [])
    if (!disciplineChoices.some((row) => row.id === id))
      disciplineChoices.push({ id, name: t(($) => $.events.existingDiscipline) });
  return (
    <EventSheet
      draft={draft}
      onDraft={(next) => {
        if (!locked && command.state === "ready") setDraft(next);
      }}
      onClose={onClose}
      onSubmit={() => {
        void submit();
      }}
      rooms={roomChoices}
      products={productChoices}
      people={personChoices}
      disciplines={disciplineChoices}
      editing={!!before}
      locked={locked}
      preparationPicker={
        !before && (
          <PreparationPicker
            scope={scope}
            kind="event"
            disabled={locked || command.state !== "ready" || command.unavailable}
            onApply={(preparation) => {
              if (preparation.kind !== "event") return;
              const { capacity, terms } = preparation.defaults;
              setDraft((current) => ({
                ...current,
                ...eventTermsDraft(capacity, terms),
                reviewed: false,
              }));
              setError(undefined);
            }}
          />
        )
      }
      readOnly={
        command.state !== "ready" ||
        (!!before &&
          (!["draft", "published"].includes(before.state) || before.attendance_state !== "open")) ||
        command.unavailable
      }
      startOffsets={startOffsets}
      endOffsets={endOffsets}
      errors={error}
      productsFooter={
        products.hasNextPage ? (
          <Button
            variant="outline"
            type="button"
            isDisabled={locked || products.isFetchingNextPage}
            onPress={() => {
              void products.fetchNextPage();
            }}
          >
            {t(($) => $.events.moreProducts)}
          </Button>
        ) : undefined
      }
      notice={
        <>
          {[rooms, people, disciplines, products].some((source) => source.isError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.events.catalogError)}{" "}
                <Button
                  variant="outline"
                  isDisabled={locked}
                  onPress={() => {
                    void Promise.all([
                      rooms.refetch(),
                      people.refetch(),
                      disciplines.refetch(),
                      products.refetch(),
                    ]);
                  }}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {before &&
            (!["draft", "published"].includes(before.state) ||
              before.attendance_state !== "open") && (
              <Alert>
                <AlertDescription>{t(($) => $.events.notEditable)}</AlertDescription>
              </Alert>
            )}
          <EventCommandNotice
            command={command}
            onReload={() => {
              void reload();
            }}
          />
          {error && command.state === "ready" && (
            <Button
              variant="outline"
              type="button"
              isDisabled={locked}
              onPress={() => {
                void reload();
              }}
            >
              {t(($) => $.profile.loadCurrent)}
            </Button>
          )}
        </>
      }
    />
  );
}
