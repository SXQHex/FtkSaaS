import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { capturePrivateReadback } from "../../lib/cache-invalidation";
import type { ClientScope } from "../../lib/scoped-backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import {
  readTeamPermissionDirectory,
  teamPermissionIntent,
  writeTeam,
  type TeamPermission,
} from "./settings-team";

type Change = {
  personId: string;
  permission: TeamPermission;
  enabled: boolean;
  version: number;
};
type SaveProgress = {
  changes: Change[];
  completed: number;
  versions: Map<string, number>;
  pending?: ReturnType<typeof teamPermissionIntent>;
  result?: Awaited<ReturnType<typeof writeTeam>>;
};

export const teamPermissionsKey = (scope: ClientScope) =>
  ["settings-team-permissions", scope] as const;

export function useSettingsTeamPermissions({
  scope,
  ownerPersonId,
  enabled,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  ownerPersonId?: string;
  enabled: boolean;
  locked: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [draft, setDraft] = useState(new Map<string, Change>());
  const [matchesReadback, setMatchesReadback] = useState(true);
  const progress = useRef<SaveProgress | undefined>(undefined);
  const matrix = useQuery({
    queryKey: teamPermissionsKey(scope),
    enabled,
    queryFn: (context) => readTeamPermissionDirectory(scope, context),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (enabled && matrix.error) onAccessLost(matrix.error);
  }, [enabled, matrix.error, onAccessLost]);

  const command = useMemberCommand({
    write: async (changes: Change[]) => {
      if (progress.current?.changes !== changes)
        progress.current = { changes, completed: 0, versions: new Map() };
      const save = progress.current;
      const assertCurrent = capturePrivateReadback(queries);
      for (const change of changes.slice(save.completed)) {
        assertCurrent();
        // Keep the exact request for the unresolved cell until it is acknowledged.
        save.pending ??= teamPermissionIntent(
          scope,
          change.personId,
          change.permission,
          change.enabled,
          save.versions.get(change.personId) ?? change.version,
        );
        const result = await writeTeam(save.pending);
        assertCurrent();
        const version = result.version;
        if (
          version === undefined ||
          !Number.isSafeInteger(version) ||
          version <= save.pending.request.expected_version
        )
          throw Error("TEAM_PERMISSION_VERSION_INVALID");
        save.versions.set(change.personId, version);
        save.result = result;
        save.pending = undefined;
        save.completed++;
      }
      if (!save.result) throw Error("TEAM_PERMISSION_SAVE_EMPTY");
      return save.result;
    },
    readResult: async (changes) => {
      const { data } = await matrix.refetch({ throwOnError: true });
      if (!data) throw Error("TEAM_PERMISSION_UNAVAILABLE");
      const people = new Map(data.map((person) => [person.id, person]));
      let matches = true;
      for (const { personId, permission, enabled } of changes) {
        const person = people.get(personId);
        const version = progress.current?.versions.get(personId);
        if (!person || version === undefined || person.version < version)
          throw Error("TEAM_PERMISSION_READBACK_STALE");
        if (person.cells[permission]?.enabled !== enabled) matches = false;
      }
      return matches;
    },
    onRefresh: async (matches) => {
      setDraft(new Map());
      setMatchesReadback(matches);
    },
    onAccessLost,
  });

  useEffect(() => {
    if (!command.locked) return;
    onLockChange(true);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);

  const rejected = command.state === "stale" || command.state === "rejected";
  const refreshAfterRejection = useEffectEvent(() => {
    if (enabled && !command.unavailable) void matrix.refetch();
  });
  useEffect(() => {
    if (rejected) refreshAfterRejection();
  }, [rejected]);

  const people =
    enabled && !command.unavailable && !matrix.isError
      ? (matrix.data ?? []).map((person) => {
          const owner = person.id === ownerPersonId;
          return { ...person, owner, canAdjust: person.staff && !person.manager && !owner };
        })
      : [];
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const changes = [...draft.values()].filter(({ personId, permission }) => {
    const person = peopleById.get(personId);
    return person?.canAdjust && person.cells[permission]?.writable;
  });
  const editable = enabled && matrix.isSuccess && !matrix.isFetching && !locked && !command.locked;
  const recovery = command.locked && !command.busy;
  const hasDraft = !rejected && changes.length > 0;
  const canSave = enabled && (recovery || (editable && hasDraft));
  const canDiscard = !locked && !command.locked && hasDraft;
  const cellKey = (personId: string, permission: TeamPermission) => `${personId}:${permission}`;
  const status = t(($) => {
    if (command.busy) return $.events.commandStates.writing;
    if (command.state === "unknown" || command.state === "pending")
      return $.settings.teamNative.permissionsRetry;
    if (command.state === "saved-unread") return $.settings.teamNative.permissionsReread;
    if (matrix.isFetching) return $.settings.unread;
    if (matrix.isError || !enabled) return $.settings.teamNative.permissionsIncomplete;
    if (rejected) return $.settings.teamNative.permissionsRejected;
    if (command.state === "saved" && !matchesReadback)
      return $.settings.teamNative.permissionsChanged;
    return hasDraft
      ? $.settings.teamNative.permissionDraft
      : $.settings.teamNative.permissionsSaved;
  });
  return {
    people,
    pending: matrix.isFetching,
    editable,
    status,
    canSave,
    canDiscard,
    selected: (personId: string, permission: TeamPermission, current: boolean) =>
      rejected ? current : (draft.get(cellKey(personId, permission))?.enabled ?? current),
    change: (personId: string, permission: TeamPermission, enabled: boolean) => {
      const person = peopleById.get(personId);
      const cell = person?.cells[permission];
      if (!editable || !person?.canAdjust || !cell?.writable) return;
      command.reset();
      setDraft((previous) => {
        const key = cellKey(personId, permission);
        const next = new Map(rejected ? undefined : previous);
        if (enabled === (cell.enabled ?? cell.effective)) next.delete(key);
        else
          next.set(key, {
            personId,
            permission,
            enabled,
            version: next.get(key)?.version ?? person.version,
          });
        return next;
      });
    },
    discard: () => {
      if (!canDiscard) return;
      command.reset();
      setDraft(new Map());
    },
    save: () => {
      if (!canSave) return;
      if (command.state === "saved-unread") void command.readReceipt();
      else if (recovery) void command.retry();
      else void command.start(changes);
    },
  };
}
