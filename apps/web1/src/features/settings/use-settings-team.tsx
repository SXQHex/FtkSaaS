import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Alert, AlertDescription } from "../../components/ui/alert";
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
  type TeamRole,
  type TeamPermission,
  type TeamIntent,
} from "./settings-team";
export function useSettingsTeam({
  scope,
  enabled,
  visible,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  enabled: boolean;
  visible: boolean;
  locked: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient();
  const [role, setRole] = useState<TeamRole>("staff"),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [index, setIndex] = useState(0),
    [person, setPerson] = useState<PersonView>(),
    [editor, setEditor] = useState<{ person?: PersonView }>(),
    [review, setReview] = useState<TeamIntent>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(false);
  const page = useQuery({
    queryKey: ["settings-team-directory", scope, role, cursors[index]],
    queryFn: () => readTeamPage(scope, role, cursors[index]),
    enabled: enabled && visible,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const records = enabled && !page.isError ? page.data?.records : undefined;
  const permissions = useQuery({
    queryKey: ["settings-team-permissions", scope, person?.id],
    queryFn: () => readTeamPermissions(scope, person!.id),
    enabled: enabled && visible && !!person,
    retry: false,
    refetchOnWindowFocus: false,
  });
  async function refresh() {
    await Promise.all([
      queries.invalidateQueries(
        { queryKey: ["settings-team-directory", scope] },
        { throwOnError: true },
      ),
      queries.invalidateQueries(
        { queryKey: ["settings-team-permissions", scope] },
        { throwOnError: true },
      ),
      queries.invalidateQueries(
        { queryKey: ["workspace", scope.accountId, scope.orgId] },
        { throwOnError: true },
      ),
    ]);
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
  async function changePermission(personId: string, key: string, value: boolean) {
    if (
      locked ||
      preparing ||
      !teamPermissions.includes(key as TeamPermission) ||
      personId !== person?.id
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
    enabled && person && !permissions.isError && permissions.data
      ? {
          people: [{ id: person.id, name: person.display_name }],
          rows: permissions.data.map((row) => ({
            id: row.permission,
            label: t(($) => $.settings.teamNative.permissions[row.permission]),
            values: { [person.id]: { value: row.enabled, writable: true } },
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
            `${row.state} · ${row.bound === null ? t(($) => $.settings.unknown) : row.bound ? t(($) => $.settings.teamNative.bound) : t(($) => $.settings.teamNative.unbound)}`,
            <div key="actions" className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked}
                onPress={() => setEditor({ person: row.person })}
              >
                {t(($) => $.settings.teamNative.edit)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={locked || row.state !== "active" || row.role === "assistant"}
                onPress={() => setPerson(row.person)}
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
              isDisabled={locked || index === 0 || page.isFetching}
              onPress={() => setIndex((value) => value - 1)}
            >
              {t(($) => $.earnings.previousPage)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || !page.data?.next_cursor || page.isFetching}
              onPress={() => {
                const next = page.data?.next_cursor;
                if (next) {
                  setCursors((values) => [...values.slice(0, index + 1), next]);
                  setIndex((value) => value + 1);
                }
              }}
            >
              {t(($) => $.earnings.nextPage)}
            </Button>
          </div>
        ),
      }
    : undefined;
  return {
    table,
    matrix,
    onPermission: (id: string, key: string, value: boolean) =>
      void changePermission(id, key, value),
    create: () => setEditor({}),
    canCreate: enabled,
    notice: visible ? (
      <div className="space-y-3">
        <Alert>
          <AlertDescription>
            {t(($) => $.settings.teamNative.directoryHint)}
            {person ? ` · ${person.display_name}` : ""}
          </AlertDescription>
        </Alert>
        {enabled && (
          <Field>
            <FieldLabel htmlFor="team-role-filter">
              {t(($) => $.settings.teamNative.roleFilter)}
            </FieldLabel>
            <NativeSelect
              id="team-role-filter"
              value={role}
              disabled={locked}
              onChange={(event) => {
                if (teamRoles.includes(event.target.value as TeamRole)) {
                  setRole(event.target.value as TeamRole);
                  setCursors([undefined]);
                  setIndex(0);
                }
              }}
            >
              {teamRoles.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {t(($) => $.settings.teamNative.roles[value])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
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
        {editor && enabled && (
          <SettingsTeamEditor
            key={editor.person?.id ?? "new"}
            scope={scope}
            initial={editor.person}
            onClose={() => {
              if (!locked) setEditor(undefined);
            }}
            onSaved={refresh}
            onLockChange={onLockChange}
            onAccessLost={onAccessLost}
          />
        )}
        {review && enabled && review.operation === "permission_set_v1" && (
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
                title: t(
                  ($) =>
                    $.settings.teamNative.permissions[review.request.permission as TeamPermission],
                ),
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
