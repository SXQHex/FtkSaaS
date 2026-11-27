import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { JobRef, PersonView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { invalidateWorkspace } from "../workspace/workspace-query";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { SettingsTeamEditor } from "./settings-team-editor";
import { SettingsTeamInvite } from "./settings-team-invite";
import { readTeamPage, readTeamPerson } from "./settings-team";
import { teamPermissionsKey, useSettingsTeamPermissions } from "./use-settings-team-permissions";

const directoryRoles = ["center_manager", "staff"] as const;
type DirectoryRole = (typeof directoryRoles)[number];

export function useSettingsTeam({
  scope,
  ownerPersonId,
  ownerAction,
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
  ownerPersonId?: string;
  ownerAction?: ReactNode;
  canReadOrganization: boolean;
  canReadCenter: boolean;
  canManageManagers: boolean;
  visible: boolean;
  showPermissions: boolean;
  locked: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [editor, setEditor] = useState<{ person: PersonView; owner: boolean }>();
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<{ text: string }>();
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(undefined), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const directory = useQuery({
    queryKey: ["settings-team-directory", scope, canReadCenter, ownerPersonId, canReadOrganization],
    enabled: visible && (canReadOrganization || canReadCenter),
    queryFn: async (context) => {
      async function readRole(role: DirectoryRole) {
        const rows: Awaited<ReturnType<typeof readTeamPage>>["records"] = [];
        const cursors = new Set<string>();
        let cursor: string | undefined;
        do {
          const page = await readTeamPage(scope, role, cursor, "center", "active", context, true);
          rows.push(...page.records);
          cursor = page.next_cursor ?? undefined;
          if (cursor) {
            if (cursors.has(cursor)) throw Error("TEAM_SOURCE_INVALID");
            cursors.add(cursor);
          }
        } while (cursor);
        return rows;
      }
      const byPerson = new Map<
        string,
        {
          person: PersonView;
          owner: boolean;
          roles: DirectoryRole[];
          active: boolean;
        }
      >();
      if (canReadCenter) {
        const lists = await Promise.all(directoryRoles.map(readRole));
        for (const row of lists.flat()) {
          if (!row.person || (row.role !== "center_manager" && row.role !== "staff"))
            throw Error("TEAM_SOURCE_INVALID");
          const person = row.person;
          const existing = byPerson.get(person.id);
          const owner = person.id === ownerPersonId || row.personId === ownerPersonId;
          byPerson.set(person.id, {
            person,
            owner: owner || !!existing?.owner,
            roles: [...new Set([...(existing?.roles ?? []), row.role])],
            active: row.bound === true || !!existing?.active,
          });
        }
      }
      if (
        ownerPersonId &&
        canReadOrganization &&
        ![...byPerson.values()].some(({ owner }) => owner)
      ) {
        const person = await readTeamPerson(scope, ownerPersonId, "org_manager", context.signal);
        if (person.id !== ownerPersonId && !person.linked_person_ids?.includes(ownerPersonId))
          throw Error("TEAM_SOURCE_INVALID");
        byPerson.set(person.id, { person, owner: true, roles: [], active: true });
      }
      return [...byPerson.values()].sort((a, b) => Number(b.owner) - Number(a.owner));
    },
    retry: false,
  });
  const denied =
    directory.error instanceof BackendError &&
    [
      "AUTH_REQUIRED",
      "SESSION_REVOKED",
      "FORBIDDEN",
      "NOT_FOUND",
      "PLAN_FEATURE_UNAVAILABLE",
    ].includes(directory.error.code);
  useEffect(() => {
    if (denied) onAccessLost(directory.error);
  }, [denied, directory.error, onAccessLost]);
  const people = directory.isError ? undefined : directory.data;
  const owner = people?.find((row) => row.owner);
  const permissionKey = teamPermissionsKey(scope);
  const permissions = useSettingsTeamPermissions({
    scope,
    ownerPersonId: owner?.person.id ?? ownerPersonId,
    enabled: visible && showPermissions && canReadCenter && !denied,
    locked,
    onLockChange,
    onAccessLost,
  });
  const permissionPeople: Omit<(typeof permissions.people)[number], "version">[] = [
    ...permissions.people,
  ];
  if (owner && !permissionPeople.some((person) => person.owner))
    permissionPeople.unshift({
      id: owner.person.id,
      name: owner.person.display_name,
      manager: canReadCenter && owner.roles.includes("center_manager"),
      staff: owner.roles.includes("staff"),
      owner: true,
      canAdjust: false,
      cells: {},
    });
  permissionPeople.sort(
    (a, b) => Number(b.owner) - Number(a.owner) || Number(b.manager) - Number(a.manager),
  );
  const canCreate = !denied && canReadCenter;
  async function refresh() {
    await invalidateCachedFamilies(queries, [["settings-team-directory", scope], permissionKey]);
    await Promise.all([
      invalidateWorkspace(queries, scope.accountId, { throwOnError: true }),
      directory.refetch({ throwOnError: true }),
    ]);
  }
  const emails =
    people?.flatMap(
      ({ person }) =>
        person.contacts?.filter((contact) => contact.kind === "email").map(({ value }) => value) ??
        [],
    ) ?? [];
  return {
    permissions: {
      ...permissions,
      people: permissionPeople,
    },
    pending: directory.isFetching,
    failed: directory.isError,
    canCreate,
    create: () => {
      if (canCreate) setInviting(true);
    },
    notice: notice?.text,
    table: people?.map(({ person, owner, roles, active }) => ({
      id: person.id,
      cells: [
        <div key="person">
          <span className="font-medium">{person.display_name}</span>
          {person.contacts?.find(({ kind }) => kind === "email")?.value && (
            <span className="team-person-email">
              {person.contacts.find(({ kind }) => kind === "email")?.value}
            </span>
          )}
        </div>,
        <div key="roles" className="flex flex-wrap gap-1">
          {owner && <Badge>{t(($) => $.settings.teamNative.owner)}</Badge>}
          {roles.map((role) => (
            <Badge key={role} variant={role === "staff" ? "secondary" : "outline"}>
              {t(($) => $.settings.teamNative.roles[role])}
            </Badge>
          ))}
        </div>,
        <Badge
          key="state"
          variant={active ? "outline" : "secondary"}
          className={active ? "text-success" : undefined}
        >
          {active ? t(($) => $.settings.teamNative.states.active) : t(($) => $.settings.unknown)}
        </Badge>,
        <div key="edit" className="team-row-actions">
          {owner && !roles.includes("center_manager") && ownerAction}
          <Button
            size="sm"
            variant="outline"
            isDisabled={locked || denied || (!canReadCenter && !canManageManagers)}
            onPress={() => setEditor({ person, owner })}
          >
            {t(($) => $.settings.teamNative.edit)}
          </Button>
        </div>,
      ],
    })),
    dialog: visible && !denied && (
      <>
        {editor && (
          <SettingsTeamEditor
            key={editor.person.id}
            scope={scope}
            initial={editor.person}
            owner={editor.owner}
            canManageManagers={canManageManagers}
            canReadCenter={canReadCenter}
            onClose={() => setEditor(undefined)}
            onCompleted={() => {
              setEditor(undefined);
              setNotice({ text: t(($) => $.settings.teamEditor.rolesSaved) });
            }}
            onSaved={refresh}
            onLockChange={onLockChange}
            onAccessLost={onAccessLost}
          />
        )}
        {inviting && canCreate && (
          <SettingsTeamInvite
            scope={scope}
            canManageManagers={canManageManagers}
            existingEmails={emails}
            onClose={() => setInviting(false)}
            onQueued={(state: JobRef["state"]) => {
              setInviting(false);
              void invalidateCachedFamilies(queries, [permissionKey]);
              void directory.refetch();
              setNotice({ text: t(($) => $.studio.invitationJobStates[state]) });
            }}
            onLockChange={onLockChange}
            onAccessLost={onAccessLost}
          />
        )}
      </>
    ),
  };
}
