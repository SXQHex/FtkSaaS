import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { SessionView, WaitlistEntryView, SeatOfferView } from "@ftksaas/api-contracts";
import { readPeoplePage } from "../people/people";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readSessionWaitlist } from "./session-detail-read";
import {
  waitlistIntent,
  writeWaitlist,
  readWaitlistReceipt,
  readWaitlistResult,
  readWaitlistTarget,
  type WaitlistAction,
  type WaitlistIntent,
} from "./session-waitlist";
import { SessionWaitlist } from "./session-detail-view";
import {
  SessionBookingSheet,
  SessionCommandRecovery,
  type SessionBookingDraft,
} from "./session-detail-panels";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Checkbox } from "@ftksaas/ui/components/checkbox";

export function SessionWaitlistController({
  scope,
  session,
  refreshRevision,
  ownPersonId,
  timezone,
  disabled,
  visible,
  recoveryOnly = false,
  onLockChange,
  onAccessLost,
  onRefresh,
  children,
}: {
  scope: ClientScope;
  session: SessionView;
  refreshRevision: number;
  ownPersonId?: string;
  timezone?: string;
  disabled: boolean;
  visible: boolean;
  recoveryOnly?: boolean;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: () => Promise<void>;
  children: (ui: { panel: ReactNode; overlay: ReactNode }) => ReactNode;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const lastRefreshRevision = useRef(refreshRevision);
  const [entriesCursors, setEntriesCursors] = useState<(string | undefined)[]>([undefined]),
    [offersCursors, setOffersCursors] = useState<(string | undefined)[]>([undefined]),
    [entriesPage, setEntriesPage] = useState(0),
    [offersPage, setOffersPage] = useState(0),
    [query, setQuery] = useState<string>(),
    [peopleCursors, setPeopleCursors] = useState<(string | undefined)[]>([undefined]),
    [peoplePage, setPeoplePage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [target, setTarget] = useState<{
    action: WaitlistAction;
    name?: string;
    entry?: WaitlistEntryView;
    offer?: SeatOfferView;
  }>();
  const [draft, setDraft] = useState<SessionBookingDraft>({
    query: "",
    personId: "",
    saleId: "",
    mode: "flexible",
    category: "",
    override: false,
    reason: "",
    reviewed: false,
  });
  const prefix = [
    "session-detail",
    scope.accountId,
    scope.orgId,
    scope.centerId,
    session.id,
    "waitlist",
  ];
  const entries = useQuery({
    queryKey: [...prefix, "entries", entriesCursors[entriesPage]],
    queryFn: (readContext) =>
      readSessionWaitlist(scope, session.id, "entries", entriesCursors[entriesPage], readContext),
    enabled: visible && !recoveryOnly,
    retry: false,
  });
  const offers = useQuery({
    queryKey: [...prefix, "offers", offersCursors[offersPage]],
    queryFn: (readContext) =>
      readSessionWaitlist(scope, session.id, "offers", offersCursors[offersPage], readContext),
    enabled: visible && !recoveryOnly,
    retry: false,
  });
  const people = useQuery({
    queryKey: [...prefix, "people", query, peopleCursors[peoplePage]],
    queryFn: (readContext) =>
      readPeoplePage(
        scope,
        query!,
        peopleCursors[peoplePage],
        "active",
        undefined,
        undefined,
        readContext,
      ),
    enabled: !recoveryOnly && query !== undefined && target?.action === "join",
    retry: false,
  });
  // Non-waitlist session mutations also invalidate these directories. When
  // the parent confirms its first-page readback, abandon both old cursor chains.
  useEffect(() => {
    if (lastRefreshRevision.current === refreshRevision) return;
    lastRefreshRevision.current = refreshRevision;
    setEntriesCursors([undefined]);
    setOffersCursors([undefined]);
    setEntriesPage(0);
    setOffersPage(0);
  }, [refreshRevision]);
  async function refreshWaitlist() {
    await onRefresh();
    await Promise.all([
      queries.fetchQuery({
        queryKey: [...prefix, "entries", undefined],
        queryFn: () => readSessionWaitlist(scope, session.id, "entries"),
        staleTime: 0,
        retry: false,
      }),
      queries.fetchQuery({
        queryKey: [...prefix, "offers", undefined],
        queryFn: () => readSessionWaitlist(scope, session.id, "offers"),
        staleTime: 0,
        retry: false,
      }),
    ]);
    setEntriesCursors([undefined]);
    setOffersCursors([undefined]);
    setEntriesPage(0);
    setOffersPage(0);
  }
  const command = useMemberCommand({
    write: writeWaitlist,
    readReceipt: readWaitlistReceipt,
    readResult: readWaitlistResult,
    onAccessLost,
    onRefresh: async () => {
      await refreshWaitlist();
    },
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const failure of [entries.error, offers.error, people.error])
      if (failure) onAccessLost(failure);
  }, [entries.error, offers.error, people.error, onAccessLost]);
  function open(next: NonNullable<typeof target>) {
    if (locked || disabled) return;
    command.reset();
    setError(false);
    setDraft((value) => ({ ...value, reviewed: false, personId: "", query: "", category: "" }));
    setQuery(undefined);
    setPeopleCursors([undefined]);
    setPeoplePage(0);
    setTarget(next);
  }
  async function submit() {
    if (!target || locked || disabled || !draft.reviewed || command.state === "saved") return;
    setBusy(true);
    setError(false);
    try {
      const personId = target.entry?.person_id ?? draft.personId;
      if (
        !personId ||
        (target.action === "join" &&
          (people.isError || !people.data?.items.some((row) => row.id === personId)))
      )
        return;
      let entry = target.entry,
        offer = target.offer,
        asOf: string | undefined;
      if (entry) {
        ({ entry, asOf } = await readWaitlistTarget(scope, session.id, personId, entry.id));
        offer = entry?.offers.find((row) => row.id === target.offer?.id);
        if (
          !entry ||
          entry.version !== target.entry!.version ||
          (target.offer && offer?.version !== target.offer.version)
        ) {
          setDraft((value) => ({ ...value, reviewed: false }));
          setError(true);
          setTarget(undefined);
          await refreshWaitlist();
          return;
        }
      }
      const intent: WaitlistIntent = waitlistIntent(
        scope,
        session.id,
        personId,
        target.action,
        draft.category || undefined,
        entry,
        offer,
        ownPersonId,
        asOf,
      );
      await command.start(intent);
    } catch (failure) {
      onAccessLost(failure);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const recovery = (
    <div className="flex flex-wrap gap-2">
      {["unknown", "pending", "saved-unread"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.readReceipt();
          }}
        >
          {t(($) => $.sessionDetail.readReceipt)}
        </Button>
      )}
      {command.state === "unknown" && (
        <Button
          variant="outline"
          isDisabled={command.busy}
          onPress={() => {
            void command.retry();
          }}
        >
          {t(($) => $.sessionDetail.retryWrite)}
        </Button>
      )}
      {["stale", "rejected"].includes(command.state) && (
        <Button
          variant="outline"
          isDisabled={locked}
          onPress={() => {
            command.reset();
            setDraft((value) => ({ ...value, reviewed: false }));
            setTarget(undefined);
            void refreshWaitlist();
          }}
        >
          {t(($) => $.sessionDetail.readSources)}
        </Button>
      )}
    </div>
  );
  const notice = (
    <>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.sessionDetail.sourceChanged)}</AlertDescription>
        </Alert>
      )}
      {command.state !== "ready" && (
        <p role="status">{t(($) => $.sessionDetail.waitlistStates[command.state])}</p>
      )}
    </>
  );
  if (recoveryOnly)
    return children({
      panel: null,
      overlay: locked && (
        <SessionCommandRecovery>
          {notice}
          {recovery}
        </SessionCommandRecovery>
      ),
    });
  const date = (value: string) =>
    timezone
      ? new Intl.DateTimeFormat("tr-TR", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: timezone,
        }).format(new Date(value))
      : t(($) => $.sessionDetail.unknown);
  function pagination(kind: "entries" | "offers") {
    const result = kind === "entries" ? entries : offers,
      page = kind === "entries" ? entriesPage : offersPage;
    const setPage = kind === "entries" ? setEntriesPage : setOffersPage,
      setCursors = kind === "entries" ? setEntriesCursors : setOffersCursors;
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          isDisabled={disabled || locked || result.isFetching || page === 0}
          onPress={() => setPage((value) => value - 1)}
        >
          {t(($) => $.sessionDetail.previous)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          isDisabled={
            disabled || locked || result.isFetching || result.isError || !result.data?.next_cursor
          }
          onPress={() => {
            const cursor = result.data?.next_cursor;
            if (cursor) {
              setCursors((old) => [...old.slice(0, page + 1), cursor]);
              setPage((value) => value + 1);
            }
          }}
        >
          {t(($) => $.sessionDetail.next)}
        </Button>
      </div>
    );
  }
  return children({
    panel: (
      <SessionWaitlist
        locked={disabled || locked || Boolean(target)}
        onAdd={session.state === "planned" ? () => open({ action: "join" }) : undefined}
        entriesAvailable={!entries.isError && Boolean(entries.data)}
        offersAvailable={!offers.isError && Boolean(offers.data)}
        rows={
          entries.isError
            ? []
            : (entries.data?.items.map((row) => ({
                id: row.id,
                position: "—",
                name: row.name,
                joined: date(row.entry.joined_at),
                state: t(($) => $.sessionDetail[row.entry.state]),
                action: ["waiting", "offered"].includes(row.entry.state) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={disabled || locked || Boolean(target)}
                    onPress={() => open({ action: "leave", name: row.name, entry: row.entry })}
                  >
                    {t(($) => $.sessionDetail.leave)} — {row.name}
                  </Button>
                ) : undefined,
              })) ?? [])
        }
        offers={
          offers.isError
            ? []
            : (offers.data?.items.map((row) => ({
                id: row.id,
                name: row.name,
                state: t(($) => $.sessionDetail[row.offer!.state]),
                expires: date(row.offer!.expires_at),
                action:
                  row.offer!.person_id === ownPersonId &&
                  row.offer!.state === "active" &&
                  Date.parse(row.offer!.expires_at) > Date.parse(offers.data!.asOf) ? (
                    <div className="flex flex-wrap gap-2">
                      {(["accept", "reject"] as const).map((action) => (
                        <Button
                          key={action}
                          size="sm"
                          variant="outline"
                          isDisabled={disabled || locked || Boolean(target)}
                          onPress={() =>
                            open({ action, name: row.name, entry: row.entry, offer: row.offer })
                          }
                        >
                          {t(($) => $.sessionDetail.offerActions[action])}
                        </Button>
                      ))}
                    </div>
                  ) : undefined,
              })) ?? [])
        }
        pagination={pagination("entries")}
        offerPagination={pagination("offers")}
        notice={
          <>
            <p className="text-sm text-muted-foreground">{t(($) => $.sessionDetail.fifoNote)}</p>
            {error && !target && (
              <Alert>
                <AlertDescription>{t(($) => $.sessionDetail.sourceChanged)}</AlertDescription>
              </Alert>
            )}
            {(entries.isError || offers.isError) && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.sessionDetail.readFailed)}</AlertDescription>
              </Alert>
            )}
            <Button
              size="sm"
              variant="outline"
              isDisabled={locked || entries.isFetching || offers.isFetching}
              onPress={() => {
                void entries.refetch();
                void offers.refetch();
              }}
            >
              {t(($) => $.sessionDetail.retry)}
            </Button>
          </>
        }
      />
    ),
    overlay:
      target?.action === "join" ? (
        <SessionBookingSheet
          open
          waitlist
          title={t(($) => $.sessionDetail.waitlist)}
          draft={draft}
          sales={[]}
          canOverride={false}
          locked={locked}
          people={
            people.isError
              ? []
              : (people.data?.items.map((row) => ({ id: row.id, label: row.display_name })) ?? [])
          }
          onDraft={(next) => {
            if (!locked) {
              command.reset();
              setDraft(next);
              setError(false);
            }
          }}
          onSearch={() => {
            setQuery(draft.query.trim());
            setPeopleCursors([undefined]);
            setPeoplePage(0);
            setDraft((value) => ({ ...value, reviewed: false, personId: "" }));
            if (query === draft.query.trim()) void people.refetch();
          }}
          peoplePagination={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                isDisabled={locked || people.isFetching || peoplePage === 0}
                onPress={() => {
                  setPeoplePage((value) => value - 1);
                  setDraft((value) => ({ ...value, personId: "", reviewed: false }));
                }}
              >
                {t(($) => $.sessionDetail.previous)}
              </Button>
              <Button
                variant="outline"
                isDisabled={
                  locked || people.isFetching || people.isError || !people.data?.next_cursor
                }
                onPress={() => {
                  const cursor = people.data?.next_cursor;
                  if (cursor) {
                    setPeopleCursors((old) => [...old.slice(0, peoplePage + 1), cursor]);
                    setPeoplePage((value) => value + 1);
                    setDraft((value) => ({ ...value, personId: "", reviewed: false }));
                  }
                }}
              >
                {t(($) => $.sessionDetail.next)}
              </Button>
            </div>
          }
          onClose={() => {
            if (!locked) setTarget(undefined);
          }}
          onSubmit={
            command.state === "saved" || command.unavailable || people.isError
              ? undefined
              : () => {
                  void submit();
                }
          }
          notice={
            <>
              {notice}
              {people.isError && (
                <Alert>
                  <AlertDescription>{t(($) => $.sessionDetail.sourceError)}</AlertDescription>
                </Alert>
              )}
            </>
          }
          recovery={recovery}
        />
      ) : target ? (
        <Sheet
          isOpen
          isDismissable={!locked}
          isKeyboardDismissDisabled={locked}
          showCloseButton={false}
          onOpenChange={(value) => {
            if (!value && !locked) setTarget(undefined);
          }}
        >
          <SheetHeader>
            <SheetTitle>{t(($) => $.sessionDetail.offerActions[target.action])}</SheetTitle>
            <SheetDescription>
              {target.name} · {t(($) => $.sessionDetail.waitlistReview)}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
            {notice}
            <Checkbox
              isSelected={draft.reviewed}
              isDisabled={locked || command.state === "saved"}
              onChange={(reviewed) => setDraft((value) => ({ ...value, reviewed }))}
            >
              {t(($) => $.sessionDetail.waitlistReview)}
            </Checkbox>
            {recovery}
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => setTarget(undefined)}
              autoFocus
            >
              {t(($) => $.sessionDetail.close)}
            </Button>
            <Button
              isDisabled={
                disabled ||
                locked ||
                !draft.reviewed ||
                command.state === "saved" ||
                command.unavailable
              }
              onPress={() => {
                void submit();
              }}
            >
              {t(($) => $.sessionDetail.confirm)}
            </Button>
          </SheetFooter>
        </Sheet>
      ) : null,
  });
}
