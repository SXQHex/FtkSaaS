import { invalidateWorkspace } from "../workspace/workspace-query";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { Button } from "@ftksaas/ui/components/button";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { SettingsTeamEditor } from "./settings-team-editor";
import { SettingsReviewDialog } from "./settings-review-dialog";
import type { SettingsViewData } from "./settings-view";
import {
  teamRoles,
  readTeamPage,
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
  level,
  enabled,
  writable,
  canManageManagers,
  visible,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  level: "center" | "organization";
  enabled: boolean;
  writable: boolean;
  canManageManagers: boolean;
  visible: boolean;
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
  const [centerRole, setCenterRole] = useState<TeamDirectoryRole>("staff"),
    [state, setState] = useState<"active" | "inactive">("active");
  const role = level === "organization" ? "org_manager" : centerRole;
  const roleOptions: readonly TeamDirectoryRole[] =
    level === "organization" ? ["org_manager"] : [...teamRoles, "center_manager"];
  const [position, setPosition] = useState<{
    key: string;
    cursors: (string | undefined)[];
    index: number;
  }>({ key: "", cursors: [undefined], index: 0 });
  const filterKey = `${level}:${role}:${state}`;
  const frame =
    position.key === filterKey ? position : { key: filterKey, cursors: [undefined], index: 0 };
  const [person, setPerson] = useState<PersonView>(),
    [permissionKeys, setPermissionKeys] = useState<readonly TeamPermission[]>(teamPermissions),
    [editor, setEditor] = useState<{ person?: PersonView; manager?: ManagerRole }>(),
    [review, setReview] = useState<TeamIntent>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const page = useQuery({
    queryKey: ["settings-team-directory", scope, level, role, state, frame.cursors[frame.index]],
    queryFn: () => readTeamPage(scope, role, frame.cursors[frame.index], level, state),
    enabled: enabled && visible,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const records = enabled && !page.isError ? page.data?.records : undefined;
  const permissions = useQuery({
    queryKey: ["settings-team-permissions", scope, person?.id, permissionKeys],
    queryFn: () => readTeamPermissions(scope, person!.id, permissionKeys),
    enabled: enabled && visible && level === "center" && !!person,
    retry: false,
    refetchOnWindowFocus: false,
  });
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
      queryKey: ["settings-team-directory", scope, level, role, state, undefined],
      queryFn: () => readTeamPage(scope, role, undefined, level, state),
      staleTime: 0,
      retry: false,
    });
    // The selected person's permission matrix has a separate Query key.
    // Invalidation alone is not an authoritative readback for the checkbox.
    if (person && level === "center" && visible) {
      await permissions.refetch({ throwOnError: true });
    }
    setPosition({ key: filterKey, cursors: [undefined], index: 0 });
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
  function reset() {
    if (locked || command.locked) return;
    setPosition({ key: "", cursors: [undefined], index: 0 });
    setPerson(undefined);
    setEditor(undefined);
    setReview(undefined);
    command.reset();
  }
  async function changePermission(personId: string, key: string, value: boolean) {
    if (
      locked ||
      preparing ||
      !writable ||
      !permissionKeys.includes(key as TeamPermission) ||
      personId !== person?.id ||
      denied
    )
      return;
    setPreparing(true);
    setError(false);
    try {
      const intent = await prepareTeamPermission(scope, personId, key as TeamPermission, value);
      command.reset();
      setAccepted(false);
      setReview(intent);
    } catch (cause) {
      if (!onAccessLost(cause)) setError(true);
    } finally {
      setPreparing(false);
    }
  }
  const matrix: SettingsViewData["permissions"] =
    enabled && level === "center" && person && !permissions.isError && permissions.data
      ? {
          people: [{ id: person.id, name: person.display_name }],
          rows: permissions.data.map((row) => ({
            id: row.permission,
            label: permissionLabels[row.permission],
            values: { [person.id]: { value: row.enabled, writable } },
          })),
        }
      : undefined;
  const table: NonNullable<SettingsViewData["tables"]>["ekip"] = records
    ? {
        columns: ["person", "roles", "state", "action"],
        rows: records.map((row) => ({
          id: row.id,
          cells: [
            row.person.display_name,
            t(($) => $.settings.teamNative.roles[row.role]),
            `${t(($) => $.settings.teamNative.states[row.state])} · ${row.bound === null ? t(($) => $.settings.unknown) : row.bound ? t(($) => $.settings.teamNative.bound) : t(($) => $.settings.teamNative.unbound)}`,
            <div key="actions" className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={
                  locked ||
                  !writable ||
                  ((row.role === "org_manager" || row.role === "center_manager") &&
                    !canManageManagers)
                }
                onPress={() =>
                  setEditor({
                    person: row.person,
                    ...(row.role === "org_manager" || row.role === "center_manager"
                      ? { manager: row.role }
                      : {}),
                  })
                }
              >
                {t(($) => $.settings.teamNative.edit)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={
                  locked || row.state !== "active" || row.role === "assistant" || level !== "center"
                }
                onPress={() => {
                  setPermissionKeys(
                    row.role === "center_manager" ? ["sale.discount"] : teamPermissions,
                  );
                  setPerson(row.person);
                }}
              >
                {t(($) => $.settings.teamNative.selectPermissions)}
              </Button>
            </div>,
          ],
        })),
        after: (
          <div className="flex flex-wrap gap-2 p-4">
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || frame.index === 0 || page.isFetching}
              onPress={() => setPosition({ ...frame, index: frame.index - 1 })}
            >
              {t(($) => $.earnings.previousPage)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || !page.data?.next_cursor || page.isFetching}
              onPress={() => {
                const next = page.data?.next_cursor;
                if (next)
                  setPosition({
                    key: filterKey,
                    cursors: [...frame.cursors.slice(0, frame.index + 1), next],
                    index: frame.index + 1,
                  });
              }}
            >
              {t(($) => $.earnings.nextPage)}
            </Button>
          </div>
        ),
      }
    : undefined;
  const canCreate =
    enabled &&
    writable &&
    !denied &&
    ((role !== "org_manager" && role !== "center_manager") || canManageManagers);
  return {
    table,
    matrix,
    reset,
    onPermission: (id: string, key: string, value: boolean) =>
      void changePermission(id, key, value),
    create: () => {
      if (canCreate)
        setEditor({
          ...(role === "org_manager" || role === "center_manager" ? { manager: role } : {}),
        });
    },
    canCreate,
    notice: visible ? (
      <div className="space-y-3">
        <Alert>
          <AlertDescription>
            {t(($) => $.settings.teamNative.directoryHint)}
            {person ? ` · ${person.display_name}` : ""}
          </AlertDescription>
        </Alert>
        {enabled && (
          <div className="flex flex-wrap gap-3">
            <Field>
              <FieldLabel htmlFor="team-role-filter">
                {t(($) => $.settings.teamNative.roleFilter)}
              </FieldLabel>
              <NativeSelect
                id="team-role-filter"
                value={role}
                disabled={locked}
                onChange={(event) => {
                  const value = event.target.value;
                  if (roleOptions.includes(value as TeamDirectoryRole)) {
                    setCenterRole(value as TeamDirectoryRole);
                    reset();
                  }
                }}
              >
                {roleOptions.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {t(($) => $.settings.teamNative.roles[value])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="team-state-filter">
                {t(($) => $.settings.teamNative.stateFilter)}
              </FieldLabel>
              <NativeSelect
                id="team-state-filter"
                value={state}
                disabled={locked}
                onChange={(event) => {
                  if (event.target.value === "active" || event.target.value === "inactive") {
                    setState(event.target.value);
                    reset();
                  }
                }}
              >
                {(["active", "inactive"] as const).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {t(($) => $.settings.teamNative.states[value])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </div>
        )}
        {(error || page.isError || permissions.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.settings.teamNative.error)}
              <Button
                variant="outline"
                isDisabled={locked}
                onPress={() => {
                  void page.refetch();
                  if (person) void permissions.refetch();
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    ) : null,
    dialog: (
      <>
        {editor && enabled && !denied && (
          <SettingsTeamEditor
            key={`${editor.person?.id ?? "new"}:${editor.manager ?? "operational"}:${level}`}
            scope={scope}
            initial={editor.person}
            manager={editor.manager}
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
                detail: person?.display_name ?? t(($) => $.settings.unknown),
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
              if (!command.locked) setReview(undefined);
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
