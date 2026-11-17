import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { readPeoplePage, readPerson } from "../people/people";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { TeamSheet } from "./team-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import {
  teamRoles,
  readTeamPersonRoles,
  prepareTeamRole,
  writeTeam,
  teamReceipt,
  teamResult,
  type TeamRole,
  type TeamIntent,
} from "./settings-team";
export function SettingsTeamEditor({
  scope,
  initial,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  initial?: PersonView;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [person, setPerson] = useState(initial),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [changes, setChanges] = useState<Partial<Record<TeamRole, boolean>>>({}),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<TeamIntent>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const busy = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const people = useQuery({
    queryKey: ["settings-team-picker", scope, query, cursors[index]],
    queryFn: () => readPeoplePage(scope, query, cursors[index]),
    enabled: !person && query.trim().length >= 2,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const roles = useQuery({
    queryKey: ["settings-team-person-roles", scope, person?.id],
    queryFn: () => readTeamPersonRoles(scope, person!.id),
    enabled: !!person,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const current = !roles.isError ? roles.data : undefined;
  const command = useMemberCommand({
    write: writeTeam,
    readReceipt: teamReceipt,
    readResult: teamResult,
    onAccessLost,
    onRefresh: async () => {
      await onSaved();
      await roles.refetch();
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const active = (role: TeamRole) =>
    current?.some(
      (row) =>
        row.role === role && row.scope_center_id === scope.centerId && row.state === "active",
    ) === true;
  async function prepare() {
    if (!person || !current || Object.keys(changes).length !== 1 || locked || busy.current) return;
    busy.current = true;
    setPreparing(true);
    setError(false);
    try {
      const [role, value] = Object.entries(changes)[0]!;
      const intent = await prepareTeamRole(scope, person.id, role as TeamRole, value!, reason);
      if (mounted.current) {
        command.reset();
        setAccepted(false);
        setReview(intent);
      }
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) setError(true);
    } finally {
      busy.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  async function choosePerson(id: string) {
    if (busy.current || locked) return;
    busy.current = true;
    setPreparing(true);
    setError(false);
    try {
      const result = await readPerson(scope, id);
      if (mounted.current) {
        setPerson(result);
        setChanges({});
      }
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) setError(true);
    } finally {
      busy.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const title = t(($) => $.settings.teamNative.title);
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={title}
        description={t(($) => $.settings.teamNative.review)}
        rows={[
          {
            id: "person",
            title: t(($) => $.settings.columns.person),
            detail: person?.display_name ?? t(($) => $.settings.unknown),
          },
          ...Object.entries(changes).map(([role, value]) => ({
            id: role,
            title: t(($) => $.settings.teamNative.roles[role as TeamRole]),
            detail: value ? t(($) => $.settings.on) : t(($) => $.settings.off),
          })),
          ...(review.operation === "role_revoke_v1" && review.preview
            ? [
                {
                  id: "sessions",
                  title: t(($) => $.settings.teamNative.affected),
                  detail: t(($) => $.settings.teamNative.sessionCount, {
                    count: review.preview.sessions.length,
                  }),
                },
                ...review.preview.sessions.map((row) => ({
                  id: row.session_id,
                  title: row.session_id,
                  detail: `${row.starts_at} – ${row.ends_at} · ${row.will_require_instructor ? t(($) => $.settings.teamNative.replacementNeeded) : t(($) => $.settings.teamNative.assignmentRemoved)}`,
                })),
              ]
            : []),
        ]}
        accepted={accepted}
        onAccepted={setAccepted}
        locked={locked}
        onClose={() => {
          if (!locked) {
            if (command.state === "ready") setReview(undefined);
            else onClose();
          }
        }}
        onApply={
          command.state === "ready" && !command.unavailable
            ? () => {
                if (accepted && !locked) void command.start(review);
              }
            : undefined
        }
        recoveryActions={
          <EventCommandNotice
            command={command}
            onReload={() => {
              if (!locked) {
                command.reset();
                setReview(undefined);
                setAccepted(false);
                setChanges({});
                void roles.refetch();
              }
            }}
          />
        }
      />
    );
  return (
    <TeamSheet
      open
      title={title}
      description={t(($) => $.settings.teamNative.hint)}
      identity={{
        name: person?.display_name ?? "",
        email: person?.contacts?.find((row) => row.kind === "email")?.value ?? "",
        writable: false,
        description: t(($) => $.settings.teamNative.identity),
      }}
      roles={
        person && current
          ? teamRoles.map((role) => ({
              key: role,
              label: t(($) => $.settings.teamNative.roles[role]),
              description: t(($) => $.settings.teamNative.roleScope),
              selected: changes[role] ?? active(role),
              writable: Object.keys(changes).length === 0 || role in changes,
            }))
          : null
      }
      effects={null}
      dirty={!!person && !!current && Object.keys(changes).length === 1}
      locked={locked}
      onRole={(key, value) => {
        if (!teamRoles.includes(key as TeamRole) || locked) return;
        const role = key as TeamRole;
        setChanges((previous) => {
          const next = { ...previous };
          if (value === active(role)) delete next[role];
          else next[role] = value;
          return next;
        });
      }}
      onReview={() => void prepare()}
      onClose={onClose}
      error={
        error || roles.isError || people.isError ? t(($) => $.settings.teamNative.error) : undefined
      }
      recoveryActions={
        <div className="space-y-3 px-5 pb-5">
          {!person && (
            <>
              <Field>
                <FieldLabel htmlFor="settings-team-search">
                  {t(($) => $.settings.teamNative.search)}
                </FieldLabel>
                <Input
                  id="settings-team-search"
                  type="search"
                  value={search}
                  maxLength={200}
                  disabled={locked}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                isDisabled={locked || search.trim().length < 2 || people.isFetching}
                onPress={() => {
                  setCursors([undefined]);
                  setIndex(0);
                  if (query === search.trim()) void people.refetch();
                  else setQuery(search.trim());
                }}
              >
                {t(($) => $.settings.teamNative.find)}
              </Button>
              {(!people.isError ? (people.data?.items ?? []) : []).map((row) => (
                <Button
                  key={row.id}
                  variant="outline"
                  isDisabled={locked}
                  onPress={() => void choosePerson(row.id)}
                >
                  {row.display_name}
                  {row.subscriber_number ? ` · ${row.subscriber_number}` : ""}
                </Button>
              ))}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={index === 0 || people.isFetching}
                  onPress={() => setIndex((value) => value - 1)}
                >
                  {t(($) => $.earnings.previousPage)}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={!people.data?.next_cursor || people.isFetching}
                  onPress={() => {
                    const next = people.data?.next_cursor;
                    if (next) {
                      setCursors((values) => [...values.slice(0, index + 1), next]);
                      setIndex((value) => value + 1);
                    }
                  }}
                >
                  {t(($) => $.earnings.nextPage)}
                </Button>
              </div>
            </>
          )}
          {person && (
            <Field>
              <FieldLabel htmlFor="team-revocation-reason">
                {t(($) => $.settings.teamNative.reason)}
              </FieldLabel>
              <Input
                id="team-revocation-reason"
                value={reason}
                maxLength={1000}
                disabled={locked}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          )}
        </div>
      }
    />
  );
}
