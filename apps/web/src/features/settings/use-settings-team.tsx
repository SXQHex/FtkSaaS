import { invalidateWorkspace } from "../workspace/workspace-query";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { SettingsTeamEditor } from "./settings-team-editor";
import { SettingsReviewDialog } from "./settings-review-dialog";
import type { SettingsTableData } from "./settings-view";
import {
  readTeamPage,
  readTeamPerson,
  readTeamPermissions,
  prepareTeamPermission,
  writeTeam,
  teamReceipt,
  teamResult,
  teamPermissions,
  type TeamDirectoryRole,
  type ManagerRole,
  type TeamPermission,
  type TeamIntent,
} from "./settings-team";
function lostScope(error: unknown) {
  return (
    (error instanceof BackendError &&
      [
        "AUTH_REQUIRED",
        "SESSION_REVOKED",
        "FORBIDDEN",
        "NOT_FOUND",
        "PLAN_FEATURE_UNAVAILABLE",
      ].includes(error.code)) ||
    (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
  );
}
export function useSettingsTeam({
  scope,
  centerLabel,
  ownPersonId,
  canReadOrganization,
  canReadCenter,
  canManageManagers,
  visible,
  showPermissions,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  centerLabel: string;
  ownPersonId?: string;
  canReadOrganization: boolean;
  canReadCenter: boolean;
  canManageManagers: boolean;
  visible: boolean;
  showPermissions: boolean;
  locked: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient();
  const permissionLabels: Record<TeamPermission, string> = {
    "person.manage": t(($) => $.settings.teamNative.permissions.person.manage),
    "person.activate": t(($) => $.settings.teamNative.permissions.person.activate),
    "invite.student": t(($) => $.settings.teamNative.permissions.invite.student),
    "reservation.write": t(($) => $.settings.teamNative.permissions.reservation.write),
    "attendance.draft": t(($) => $.settings.teamNative.permissions.attendance.draft),
    "sale.write": t(($) => $.settings.teamNative.permissions.sale.write),
    "finance.collect": t(($) => $.settings.teamNative.permissions.finance.collect),
    "reservation.capacity_override": t(
      ($) => $.settings.teamNative.permissions.reservation.capacity_override,
    ),
    "sale.discount": t(($) => $.settings.teamNative.permissions.sale.discount),
  };
  const enabled = canReadOrganization || canReadCenter;
  const roleOptions: TeamDirectoryRole[] = [
    ...(canReadOrganization ? ["org_manager" as const] : []),
    ...(canReadCenter ? ["center_manager" as const, "staff" as const] : []),
  ];
  const directoryKey = ["settings-team-directory", scope, roleOptions] as const;
  type Cursors = Partial<Record<TeamDirectoryRole, string | null>>;
  const [frames, setFrames] = useState<Cursors[]>([{}]);
  const cursors = frames.at(-1) ?? {};
  async function readDirectory(
    position: Cursors,
    context: Parameters<typeof readTeamPage>[5],
    history: Cursors[],
  ) {
    const pages = await Promise.all(
      roleOptions.flatMap((role) =>
        position[role] === null
          ? []
          : [
              readTeamPage(
                scope,
                role,
                position[role] ?? undefined,
                role === "org_manager" ? "organization" : "center",
                "active",
                context,
              ).then((result) => ({ role, ...result })),
            ],
      ),
    );
    const records = pages.flatMap((page) => page.records);
    const next = { ...position };
    for (const { role, next_cursor } of pages) {
      if (next_cursor && history.some((frame) => frame[role] === next_cursor))
        throw Error("TEAM_SOURCE_INVALID");
      next[role] = next_cursor;
    }
    return { records, next, hasNext: pages.some((page) => !!page.next_cursor) };
  }
  const [draft, setDraft] = useState<{
    personId: string;
    permission: TeamPermission;
    enabled: boolean;
  }>();
  const [editor, setEditor] = useState<{ person?: PersonView; manager?: ManagerRole }>(),
    [review, setReview] = useState<TeamIntent>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const selectionRead = useRef<AbortController | null>(null);
  useEffect(() => () => selectionRead.current?.abort(), [enabled, visible]);
  const page = useQuery({
    queryKey: [...directoryKey, cursors],
    queryFn: (context) => readDirectory(cursors, context, frames),
    enabled: enabled && visible,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const records = enabled && !page.isError ? page.data?.records : undefined;
  const teamMembers = new Map<string, { id: string; name: string; role: TeamDirectoryRole }>();
  for (const row of records ?? []) {
    const id = row.person?.id ?? row.personId;
    const current = teamMembers.get(id);
    if (!current || row.role === "center_manager" || current.role === "org_manager")
      teamMembers.set(id, { id, name: row.name, role: row.role });
  }
  const readableMembers = [...teamMembers.values()].filter(
    (member) => member.role !== "org_manager",
  );
  const permissions = useQuery({
    queryKey: [
      "settings-team-permissions",
      scope,
      readableMembers.map(({ id, role }) => [id, role]),
    ],
    queryFn: async (context) => {
      const summaries = new Map<string, Awaited<ReturnType<typeof readTeamPermissions>>>();
      for (let start = 0; start < readableMembers.length; start += 4) {
        await Promise.all(
          readableMembers.slice(start, start + 4).map(async ({ id, role }) => {
            try {
              const rows = await readTeamPermissions(scope, id, context);
              summaries.set(
                id,
                role === "center_manager"
                  ? rows.filter((row) => row.permission === "sale.discount")
                  : rows,
              );
            } catch (cause) {
              if (lostScope(cause) || context.signal.aborted) throw cause;
              if (!(cause instanceof Error) || cause.message !== "TEAM_PERMISSION_UNAVAILABLE")
                throw cause;
            }
          }),
        );
      }
      return summaries;
    },
    enabled: canReadCenter && visible && showPermissions && readableMembers.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (draft && (!visible || !showPermissions)) setDraft(undefined);
  const denied = lostScope(page.error) || lostScope(permissions.error);
  useEffect(() => {
    for (const error of [page.error, permissions.error])
      if (lostScope(error)) {
        onAccessLost(error);
        break;
      }
  }, [page.error, permissions.error, onAccessLost]);
  async function refresh() {
    await invalidateCachedFamilies(queries, [
      ["settings-team-directory", scope],
      ["settings-team-permissions", scope],
    ]);
    await invalidateWorkspace(queries, scope.accountId, { throwOnError: true });
    await queries.fetchQuery({
      queryKey: [...directoryKey, {}],
      queryFn: (context) => readDirectory({}, context, []),
      staleTime: 0,
      retry: false,
    });
    // The selected person's permission matrix has a separate Query key.
    // Invalidation alone is not an authoritative readback for the checkbox.
    if (showPermissions && canReadCenter && visible && readableMembers.length) {
      await permissions.refetch({ throwOnError: true });
    }
    setDraft(undefined);
    setFrames([{}]);
  }
  const command = useMemberCommand({
    write: writeTeam,
    readReceipt: teamReceipt,
    readResult: teamResult,
    onAccessLost,
    onRefresh: refresh,
  });
  useEffect(() => {
    if (preparing || command.locked) {
      onLockChange(true);
      return () => onLockChange(false);
    }
  }, [preparing, command.locked, onLockChange]);
  async function selectTeamPerson(
    row: Awaited<ReturnType<typeof readTeamPage>>["records"][number],
  ) {
    if (locked || preparing || denied || selectionRead.current) return;
    const controller = new AbortController();
    selectionRead.current = controller;
    setPreparing(true);
    setError(false);
    const manager =
      row.role === "org_manager" || row.role === "center_manager" ? row.role : undefined;
    try {
      const selected =
        row.person ??
        (await readTeamPerson(
          scope,
          row.personId,
          manager === "org_manager" ? manager : undefined,
          controller.signal,
        ));
      if (controller.signal.aborted) return;
      if (selected.id !== row.personId && !selected.linked_person_ids?.includes(row.personId))
        throw Error("TEAM_SOURCE_INVALID");
      setEditor({ person: selected, manager });
    } catch (cause) {
      if (!controller.signal.aborted && !onAccessLost(cause)) setError(true);
    } finally {
      selectionRead.current = null;
      setPreparing(false);
    }
  }
  async function reviewPermission() {
    if (locked || preparing || !canReadCenter || permissions.isError || !draft || denied) return;
    setPreparing(true);
    setError(false);
    try {
      const intent = await prepareTeamPermission(
        scope,
        draft.personId,
        draft.permission,
        draft.enabled,
      );
      command.reset();
      setAccepted(false);
      setReview(intent);
    } catch (cause) {
      if (!onAccessLost(cause)) setError(true);
    } finally {
      setPreparing(false);
    }
  }
  const permissionRows = teamPermissions.filter((key) =>
    readableMembers.some(({ id }) =>
      permissions.data?.get(id)?.some((row) => row.permission === key),
    ),
  );
  const matrix = {
    people: [...teamMembers.values()],
    rows: permissionRows.map((key) => ({
      id: key,
      label: permissionLabels[key],
      values: Object.fromEntries(
        readableMembers.flatMap(({ id }) => {
          const row = permissions.data?.get(id)?.find((value) => value.permission === key);
          if (!row || permissions.isError) return [];
          const value = row.enabled ?? row.effectiveStaffGrant;
          const selected = draft?.personId === id && draft.permission === key;
          return [
            [
              id,
              {
                value: selected ? draft.enabled : value,
                writable: canReadCenter && !permissions.isFetching && (!draft || selected),
                change: (enabled: boolean) =>
                  setDraft(
                    enabled === value ? undefined : { personId: id, permission: key, enabled },
                  ),
              },
            ] as const,
          ];
        }),
      ),
    })),
  };
  const grouped = new Map<string, NonNullable<typeof records>>();
  for (const row of records ?? []) {
    const personId = row.person?.id ?? row.personId;
    const rows = grouped.get(personId);
    if (rows) rows.push(row);
    else grouped.set(personId, [row]);
  }
  function canEditAssignment(role: TeamDirectoryRole) {
    if (role === "org_manager") return canManageManagers;
    return canReadCenter || (role === "center_manager" && canManageManagers);
  }
  const table: SettingsTableData | undefined = records
    ? {
        columns: ["person", "roles", "state", "action"],
        rows: Array.from(grouped, ([id, rows]) => {
          const [first] = rows;
          const edit = rows.find((row) => canEditAssignment(row.role));
          const email = rows
            .find((row) => row.person)
            ?.person?.contacts?.find((contact) => contact.kind === "email")?.value;
          const bound = rows.every((row) => row.bound === true);
          const anyBound = rows.some((row) => row.bound === true);
          return {
            id,
            cells: [
              <div key="person">
                <span className="font-medium">{first?.name}</span>
                {email && <span className="block text-xs text-muted-foreground">{email}</span>}
              </div>,
              <div key="roles" className="flex flex-wrap gap-1">
                {rows.map((row) => (
                  <Badge key={row.id} variant={row.role === "staff" ? "secondary" : "outline"}>
                    {t(($) => $.settings.teamNative.roles[row.role])}
                  </Badge>
                ))}
              </div>,
              <Badge
                key="state"
                variant={bound ? "outline" : "secondary"}
                className={bound ? "text-success" : undefined}
              >
                {bound
                  ? t(($) => $.settings.teamNative.states.active)
                  : anyBound || rows.some((row) => row.bound === null)
                    ? t(($) => $.settings.unknown)
                    : t(($) => $.settings.teamNative.unbound)}
              </Badge>,
              <Button
                key="edit"
                variant="outline"
                size="sm"
                isDisabled={locked || !edit}
                onPress={() => {
                  if (edit) void selectTeamPerson(edit);
                }}
              >
                {t(($) => $.settings.teamNative.edit)}
              </Button>,
            ],
          };
        }),
        after:
          frames.length > 1 || page.data?.hasNext ? (
            <div className="flex flex-wrap gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked || frames.length === 1 || page.isFetching}
                onPress={() => {
                  setDraft(undefined);
                  setFrames(frames.slice(0, -1));
                }}
              >
                {t(($) => $.earnings.previousPage)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked || !page.data?.hasNext || page.isFetching}
                onPress={() => {
                  if (page.data?.hasNext) {
                    setDraft(undefined);
                    setFrames([...frames, page.data.next]);
                  }
                }}
              >
                {t(($) => $.earnings.nextPage)}
              </Button>
            </div>
          ) : undefined,
      }
    : undefined;
  const canCreate = enabled && !denied && (canReadCenter || canManageManagers);
  return {
    table,
    matrix,
    permissionLoading: permissions.isFetching,
    permissionUnavailable: permissions.isError || !canReadCenter || !permissionRows.length,
    permissionDraft: !!draft,
    permissionIncomplete: !!permissions.data && permissions.data.size < readableMembers.length,
    discardPermission: () => setDraft(undefined),
    reviewPermission: () => void reviewPermission(),
    create: () => {
      if (!canCreate) return;
      setEditor({});
    },
    canCreate,
    notice:
      visible && (error || page.isError || permissions.isError) ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.settings.teamNative.error)}
            <Button
              variant="outline"
              isDisabled={locked}
              onPress={() => {
                void page.refetch();
                if (showPermissions && readableMembers.length) void permissions.refetch();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null,
    dialog: (
      <>
        {editor &&
          visible &&
          !denied &&
          (editor.person ? canEditAssignment(editor.manager ?? "staff") : canCreate) && (
            <SettingsTeamEditor
              key={`${editor.person?.id ?? "new"}:${editor.manager ?? "operational"}`}
              scope={scope}
              initial={editor.person}
              manager={editor.manager}
              canManageManagers={canManageManagers}
              canReadCenter={canReadCenter}
              centerLabel={centerLabel}
              ownPersonId={ownPersonId}
              onClose={() => {
                if (!locked) setEditor(undefined);
              }}
              onSaved={refresh}
              onLockChange={onLockChange}
              onAccessLost={onAccessLost}
            />
          )}
        {review && enabled && !denied && review.operation === "permission_set_v1" && (
          <SettingsReviewDialog
            open
            title={t(($) => $.settings.teamNative.permissionTitle)}
            description={t(($) => $.settings.teamNative.permissionHint)}
            rows={[
              {
                id: "person",
                title: t(($) => $.settings.columns.person),
                detail:
                  teamMembers.get(review.request.person_id)?.name ?? t(($) => $.settings.unknown),
              },
              {
                id: "permission",
                title: permissionLabels[review.request.permission as TeamPermission],
                detail: review.request.enabled ? t(($) => $.settings.on) : t(($) => $.settings.off),
              },
            ]}
            accepted={accepted}
            onAccepted={setAccepted}
            locked={command.locked}
            onClose={() => {
              if (!command.locked) {
                setReview(undefined);
                setDraft(undefined);
              }
            }}
            onApply={
              command.state === "ready" && !command.unavailable
                ? () => {
                    if (accepted && !command.locked) void command.start(review);
                  }
                : undefined
            }
            recoveryActions={
              <EventCommandNotice
                command={command}
                onReload={() => {
                  if (!command.locked) {
                    command.reset();
                    setReview(undefined);
                    setAccepted(false);
                    setDraft(undefined);
                    void permissions.refetch();
                  }
                }}
              />
            }
          />
        )}
      </>
    ),
  };
}
