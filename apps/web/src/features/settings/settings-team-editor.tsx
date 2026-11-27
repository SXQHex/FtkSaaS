import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PersonView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Dialog, DialogTitle } from "@ftksaas/ui/components/dialog";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { cacheVerifiedReadback, invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { invalidateLeadPages } from "../leads/leads-query";
import { useMemberCommand } from "../member-profile/use-member-command";
import { TeamSheet } from "./team-sheet";
import { SettingsStaffRoleRemoval } from "./settings-staff-role-removal";
import {
  readTeamPersonRoles,
  prepareTeamRole,
  writeTeam,
  teamReceipt,
  teamResult,
  type TeamIntent,
} from "./settings-team";

const roleOptions = ["center_manager", "staff"] as const;
type EditableTeamRole = (typeof roleOptions)[number];
type RemovalPreview =
  | { kind: "staff"; assignmentId: string }
  | { kind: "blocked"; roles: EditableTeamRole[]; hasSeparateAddition: boolean };

export function SettingsTeamEditor({
  scope,
  initial,
  canManageManagers,
  canReadCenter,
  owner,
  onSaved,
  onClose,
  onCompleted,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  initial: PersonView;
  canManageManagers: boolean;
  canReadCenter: boolean;
  owner: boolean;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onCompleted: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const name = initial.display_name;
  const email = initial.contacts?.find((row) => row.kind === "email")?.value ?? "";
  const [changes, setChanges] = useState<Partial<Record<EditableTeamRole, boolean>>>({});
  const [preview, setPreview] = useState<RemovalPreview>();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(false);
  const [missingAccount, setMissingAccount] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const organizationRead = canManageManagers && !canReadCenter ? "org_manager" : undefined;
  const rolesKey = ["settings-team-person-roles", scope, organizationRead, initial.id];
  const roles = useQuery({
    queryKey: rolesKey,
    queryFn: (context) => readTeamPersonRoles(scope, initial.id, organizationRead, context),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const current = roles.isError ? undefined : roles.data;
  const command = useMemberCommand({
    write: writeTeam,
    readReceipt: teamReceipt,
    readResult: async (intent: TeamIntent, id) => {
      if (intent.operation !== "role_revoke_v1")
        return { verifiedRoles: await teamResult(intent, id) };
      if (id !== intent.request.assignment_id) throw Error("TEAM_RESULT_UNAVAILABLE");
      const updated = await readTeamPersonRoles(intent.scope, initial.id);
      if (
        !updated.some(
          (role) =>
            role.id === id &&
            role.role === "staff" &&
            role.scope_center_id === intent.scope.centerId &&
            role.state === "inactive" &&
            role.version > intent.request.expected_version,
        )
      )
        throw Error("TEAM_RESULT_UNAVAILABLE");
      return {
        verifiedRoles: updated,
        removal: { handedOver: !!intent.request.handover_person_id },
      };
    },
    onAccessLost: (cause) => {
      if (cause instanceof BackendError && cause.code === "ACCOUNT_LINK_REQUIRED")
        setMissingAccount(true);
      return onAccessLost(cause);
    },
    onRefresh: async ({ verifiedRoles, removal }, assertCurrent) => {
      if (removal) {
        const crmScope = [scope.accountId, scope.orgId, scope.centerId];
        const assignees = ["lead-assignees", ...crmScope];
        await invalidateCachedFamilies(
          queryClient,
          [
            ["settings-team-person-roles", scope],
            assignees,
            ...(removal.handedOver
              ? [
                  ["lead-detail", ...crmScope],
                  ["lead-activities", ...crmScope],
                ]
              : []),
          ],
          [assignees],
        );
        if (removal.handedOver) await invalidateLeadPages(queryClient, scope);
        assertCurrent();
      }
      if (verifiedRoles && !organizationRead)
        await cacheVerifiedReadback(queryClient, rolesKey, verifiedRoles);
      else await roles.refetch({ throwOnError: true });
      assertCurrent();
      await onSaved();
    },
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    if (!locked) return;
    onLockChange(true);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const activeAssignment = (role: EditableTeamRole) =>
    current?.find(
      (row) =>
        row.role === role && row.scope_center_id === scope.centerId && row.state === "active",
    );
  const active = (role: EditableTeamRole) => !!activeAssignment(role);
  const checked = (role: EditableTeamRole) => changes[role] ?? active(role);
  const canWrite = (role: EditableTeamRole) =>
    role === "center_manager" ? canManageManagers : canReadCenter;
  const additions = roleOptions.filter((role) => checked(role) && !active(role));
  const removals = roleOptions.filter((role) => current && !checked(role) && active(role));
  const labels = (options: readonly EditableTeamRole[]) =>
    options.map((role) => t(($) => $.settings.teamNative.roles[role])).join(", ");
  const recovery = ["unknown", "pending", "saved-unread"].includes(command.state);
  const writableAddition = additions.find(canWrite);
  const effects = [
    ...(additions.length
      ? [t(($) => $.settings.teamNative.effectAdd, { role: labels(additions) })]
      : []),
    ...(removals.length
      ? [t(($) => $.settings.teamNative.effectRemove, { role: labels(removals) })]
      : []),
    ...(checked("center_manager") ? [t(($) => $.settings.teamNative.centerManagerEffect)] : []),
    ...(checked("staff") && !checked("center_manager")
      ? [t(($) => $.settings.teamNative.staffEffect)]
      : []),
    ...(owner && !checked("center_manager") ? [t(($) => $.settings.teamEditor.ownerEffect)] : []),
  ];
  async function saveRole(role: EditableTeamRole) {
    if (saving.current || !canWrite(role)) return;
    saving.current = true;
    setPreparing(true);
    setError(false);
    setMissingAccount(false);
    try {
      const intent = await prepareTeamRole(scope, initial.id, role, true, "");
      if (!mounted.current) return;
      command.reset();
      await command.start(intent);
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) setError(true);
    } finally {
      saving.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const finishSavedEdit = useEffectEvent(() => {
    if (!preview && writableAddition) void saveRole(writableAddition);
    else onCompleted();
  });
  useEffect(() => {
    if (locked || command.state !== "saved") return;
    const frame = requestAnimationFrame(() => finishSavedEdit());
    return () => cancelAnimationFrame(frame);
  }, [locked, command.state]);
  const submit = () => {
    if (command.unavailable) return;
    if (command.state === "unknown") void command.retry();
    else if (recovery) void command.readReceipt();
    else if (removals.length) {
      const staff = activeAssignment("staff");
      const staffOnly =
        canReadCenter && removals.length === 1 && removals[0] === "staff" && additions.length === 0;
      command.reset();
      setPreview(
        staffOnly && staff
          ? { kind: "staff", assignmentId: staff.id }
          : {
              kind: "blocked",
              roles: removals,
              hasSeparateAddition: removals.includes("staff") && additions.length > 0,
            },
      );
    } else if (writableAddition) void saveRole(writableAddition);
  };
  return (
    <>
      <TeamSheet
        open
        title={t(($) => $.settings.teamNative.title)}
        description={name}
        identity={{ name, email, description: t(($) => $.settings.teamNative.identity) }}
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
          ...roleOptions.map((role) => ({
            key: role,
            label: t(($) => $.settings.teamNative.roles[role]),
            description:
              role === "center_manager"
                ? t(($) => $.settings.teamNative.centerManagerDescription)
                : t(($) => $.settings.teamNative.staffDescription),
            selected: checked(role),
            writable: !!current && (role === "staff" || canWrite(role)),
          })),
        ]}
        rolesUnread={!current}
        effects={effects.length ? effects : [t(($) => $.settings.teamNative.noChanges)]}
        submitLabel={
          removals.length
            ? t(($) => $.settings.teamEditor.review)
            : t(($) => $.settings.teamEditor.save)
        }
        dirty={
          !command.unavailable &&
          (!!writableAddition || !!removals.length) &&
          additions.every(canWrite)
        }
        locked={locked}
        canCheckResult={recovery && !command.busy && !preparing}
        onRole={(role, value) => {
          if (locked || (role !== "center_manager" && role !== "staff")) return;
          setChanges((previous) => ({ ...previous, [role]: value }));
        }}
        onReview={submit}
        onClose={onClose}
        error={
          missingAccount
            ? t(($) => $.settings.teamEditor.verifiedAccountRequired)
            : error || roles.isError
              ? t(($) => $.settings.teamNative.error)
              : command.state !== "ready" &&
                  command.state !== "saved" &&
                  command.state !== "writing" &&
                  !command.busy
                ? t(($) => $.events.commandStates[command.state])
                : additions.includes("staff") && !canReadCenter
                  ? t(($) => $.settings.teamNative.staffSaveAuthority)
                  : undefined
        }
      />
      {preview?.kind === "staff" && (
        <SettingsStaffRoleRemoval
          scope={scope}
          person={initial}
          assignmentId={preview.assignmentId}
          canWrite={canReadCenter}
          command={command}
          onClose={() => {
            command.reset();
            setPreview(undefined);
          }}
          onAccessLost={onAccessLost}
        />
      )}
      {preview?.kind === "blocked" && (
        <Dialog
          isOpen
          onOpenChange={(open) => {
            if (!open) setPreview(undefined);
          }}
          showCloseButton={false}
          className="team-removal-dialog"
        >
          <div className="team-card-header">
            <DialogTitle>{t(($) => $.settings.teamEditor.removalTitle)}</DialogTitle>
          </div>
          <div className="team-card-content">
            <p className="text-muted-foreground">
              {t(($) => $.settings.teamEditor.removalDescription, {
                person: name,
                role: labels(preview.roles),
              })}
            </p>
            <p className="text-muted-foreground" role="status">
              {t(($) =>
                preview.hasSeparateAddition
                  ? $.settings.teamEditor.staffRemovalSeparate
                  : $.settings.teamEditor.removalUnavailable,
              )}
            </p>
          </div>
          <div className="team-card-footer justify-end">
            <Button variant="outline" onPress={() => setPreview(undefined)}>
              {t(($) => $.settings.discard)}
            </Button>
            <Button variant="destructive" isDisabled>
              {t(($) => $.settings.teamEditor.removeRole)}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
