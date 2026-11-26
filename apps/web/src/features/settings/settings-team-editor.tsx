import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { TeamSheet } from "./team-sheet";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Button } from "@ftksaas/ui/components/button";
import {
  teamRoles,
  readTeamPeople,
  readTeamPerson,
  readTeamPersonRoles,
  prepareTeamRole,
  writeTeam,
  teamReceipt,
  teamResult,
  type TeamDirectoryRole,
  type ManagerRole,
  type TeamIntent,
} from "./settings-team";
export function SettingsTeamEditor({
  scope,
  initial,
  manager,
  canManageManagers,
  canReadCenter,
  centerLabel,
  ownPersonId,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  initial?: PersonView;
  manager?: ManagerRole;
  canManageManagers: boolean;
  canReadCenter: boolean;
  centerLabel: string;
  ownPersonId?: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const adding = !initial;
  const organizationSearch = adding && canManageManagers ? "org_manager" : manager;
  const roleOptions = ["center_manager", "staff"] as const satisfies readonly TeamDirectoryRole[];
  const extraRoles: TeamDirectoryRole[] = [
    ...((adding && canManageManagers) || manager === "org_manager" ? ["org_manager" as const] : []),
    ...(!adding && canReadCenter ? teamRoles.filter((role) => role !== "staff") : []),
  ];
  const [person, setPerson] = useState(initial),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [changes, setChanges] = useState<Partial<Record<TeamDirectoryRole, boolean>>>({}),
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
    queryKey: ["settings-team-picker", scope, organizationSearch, query, cursors[index]],
    queryFn: (context) => readTeamPeople(scope, query, cursors[index], organizationSearch, context),
    enabled: !person && query.trim().length >= 2,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const rolesKey = ["settings-team-person-roles", scope, organizationSearch, person?.id] as const;
  const roles = useQuery({
    queryKey: rolesKey,
    queryFn: (context) => readTeamPersonRoles(scope, person!.id, organizationSearch, context),
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
    onRefresh: async (_result, assertCurrent) => {
      await onSaved();
      assertCurrent();
      await roles.refetch({ throwOnError: true });
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const active = (role: TeamDirectoryRole) =>
    current?.some(
      (row) =>
        row.role === role &&
        row.scope_center_id === (role === "org_manager" ? null : scope.centerId) &&
        row.state === "active",
    ) === true;
  async function prepare() {
    if (!person || !current || Object.keys(changes).length !== 1 || locked || busy.current) return;
    const [role, enabled] = Object.entries(changes)[0]!;
    const selectedRole = role as TeamDirectoryRole;
    if (!canChangeRole(selectedRole) || enabled === undefined) return;
    busy.current = true;
    setPreparing(true);
    setError(false);
    try {
      const intent = await prepareTeamRole(scope, person.id, selectedRole, enabled, reason);
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
      const result = await readTeamPerson(scope, id, organizationSearch);
      if (result.id !== id && !result.linked_person_ids?.includes(id))
        throw Error("TEAM_SOURCE_INVALID");
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
  const title = adding ? t(($) => $.settings.invite) : t(($) => $.settings.teamNative.title);
  const targetCenter = changes.center_manager !== undefined ? centerLabel : undefined;
  const removal = Object.values(changes).includes(false);
  const owner =
    !!person &&
    ((canManageManagers && person.id === ownPersonId) ||
      current?.some(
        (row) => row.role === "owner" && row.scope_center_id === null && row.state === "active",
      ));
  function canChangeRole(role: TeamDirectoryRole) {
    if (role === "center_manager")
      return canManageManagers && (!adding || person?.id !== ownPersonId);
    if (role === "org_manager") return canManageManagers;
    return canReadCenter;
  }
  const selected = (role: TeamDirectoryRole) => changes[role] ?? active(role);
  const describeRole = (role: TeamDirectoryRole) => ({
    key: role,
    label: t(($) => $.settings.teamNative.roles[role]),
    description:
      role === "center_manager"
        ? t(($) => $.settings.teamNative.centerManagerDescription)
        : role === "staff"
          ? t(($) => $.settings.teamNative.staffDescription)
          : t(($) => $.settings.teamNative.roleScope),
    selected: selected(role),
    writable:
      !!person &&
      !!current &&
      canChangeRole(role) &&
      (!adding || !active(role)) &&
      (Object.keys(changes).length === 0 || role in changes),
  });
  const effects = [
    ...(adding ? [t(($) => $.settings.teamNative.verifiedEffect)] : []),
    ...Object.entries(changes).map(([role, enabled]) => {
      const label = t(($) => $.settings.teamNative.roles[role as TeamDirectoryRole]);
      return enabled
        ? t(($) => $.settings.teamNative.effectAdd, { role: label })
        : t(($) => $.settings.teamNative.effectRemove, { role: label });
    }),
    ...(selected("center_manager") ? [t(($) => $.settings.teamNative.centerManagerEffect)] : []),
    ...(selected("staff") && !selected("center_manager")
      ? [t(($) => $.settings.teamNative.staffEffect)]
      : []),
    ...(owner && !selected("center_manager")
      ? [t(($) => $.settings.teamNative.ownershipNote)]
      : []),
  ];
  if (review)
    return (
      <SettingsReviewDialog
        open
        title={title}
        description={t(($) => $.settings.teamNative.review)}
        rows={[
          ...(targetCenter
            ? [
                {
                  id: "center",
                  title: t(($) => $.settings.teamNative.targetCenter),
                  detail: targetCenter,
                },
              ]
            : []),
          {
            id: "person",
            title: t(($) => $.settings.columns.person),
            detail: person?.display_name ?? t(($) => $.settings.unknown),
          },
          ...Object.entries(changes).map(([role, value]) => ({
            id: role,
            title: t(($) => $.settings.teamNative.roles[role as TeamDirectoryRole]),
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
      description={
        adding ? t(($) => $.settings.teamNative.inviteDescription) : (person?.display_name ?? "")
      }
      identity={{
        name: person?.display_name ?? "",
        email: person?.contacts?.find((row) => row.kind === "email")?.value ?? "",
        description: adding ? undefined : t(($) => $.settings.teamNative.identity),
      }}
      roles={[
        ...(owner
          ? [
              {
                key: "owner",
                label: t(($) => $.settings.teamNative.owner),
                description: t(($) => $.settings.teamNative.ownerDescription),
                selected: true,
                writable: false,
              },
            ]
          : []),
        ...roleOptions.map(describeRole),
      ]}
      extraRoles={extraRoles.map(describeRole)}
      rolesUnread={!!person && !current}
      effects={effects.length ? effects : [t(($) => $.settings.teamNative.noChanges)]}
      submitLabel={
        adding
          ? t(($) => $.settings.teamNative.roleAction)
          : removal
            ? t(($) => $.settings.teamEditor.review)
            : t(($) => $.settings.teamEditor.save)
      }
      dirty={!!person && !!current && Object.keys(changes).length === 1}
      locked={locked}
      onRole={(key, value) => {
        if (locked || ![...roleOptions, ...extraRoles].includes(key as TeamDirectoryRole)) return;
        const role = key as TeamDirectoryRole;
        if (!person || !current || !canChangeRole(role) || (adding && active(role))) return;
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
        <div className="grid gap-3">
          {adding && person && (
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => {
                setPerson(undefined);
                setChanges({});
                setQuery("");
                setSearch("");
                setCursors([undefined]);
                setIndex(0);
              }}
            >
              {t(($) => $.settings.teamNative.chooseAnotherPerson)}
            </Button>
          )}
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
              {(index > 0 || people.data?.next_cursor) && (
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
              )}
            </>
          )}
          {canReadCenter &&
            current
              ?.filter(
                (row) =>
                  row.scope_center_id === scope.centerId &&
                  row.state === "active" &&
                  row.account_access_granted === false &&
                  teamRoles.includes(row.role as (typeof teamRoles)[number]),
              )
              .map((row) => (
                <Button
                  key={row.id}
                  variant="outline"
                  isDisabled={locked}
                  onPress={() => setChanges({ [row.role]: true })}
                >
                  {t(($) => $.settings.teamNative.bind, {
                    role: t(
                      ($) => $.settings.teamNative.roles[row.role as (typeof teamRoles)[number]],
                    ),
                  })}
                </Button>
              ))}
          {person && removal && (
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
