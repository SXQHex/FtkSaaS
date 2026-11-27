import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import type { JobRef } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import {
  createPerson,
  personCreateIntent,
  personEntrySchema,
  readPerson,
  readPersonInvitationJob,
  sendPersonInvitation,
  type PersonCreateIntent,
} from "../people/people";
import { TeamSheet } from "./team-sheet";
import { teamRoleAssignment, writeTeam } from "./settings-team";

const inviteRoles = ["center_manager", "staff"] as const;
type InviteRole = (typeof inviteRoles)[number];
type InviteFailure = "rejected" | "inviteUnread" | "roleUnread" | "rolesRejected" | "jobUnread";

export function SettingsTeamInvite({
  scope,
  existingEmails,
  canManageManagers,
  onQueued,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  existingEmails: string[];
  canManageManagers: boolean;
  onQueued: (state: JobRef["state"]) => void;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState({ center_manager: false, staff: false });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<InviteFailure>();
  const [created, setCreated] = useState(false);
  const attempt = useRef<{
    create: PersonCreateIntent;
    inviteKey: string;
    createdId?: string;
    roles: readonly InviteRole[];
    remaining?: ReturnType<typeof teamRoleAssignment>[];
    job?: JobRef;
  }>(undefined);
  const running = useRef(false);
  const mounted = useRef(true);
  const uncertain =
    failure === "inviteUnread" || failure === "roleUnread" || failure === "jobUnread";
  const locked = busy || uncertain;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!locked) return;
    onLockChange(true);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useBlocker({
    shouldBlockFn: () => running.current || uncertain,
    enableBeforeUnload: locked,
    disabled: !locked,
  });
  const validation = personEntrySchema({
    name: t(($) => $.settings.teamEditor.requiredName),
    email: t(($) => $.settings.teamEditor.invalidEmail),
  }).safeParse({ name, email: email.trim() });
  const duplicate =
    validation.success &&
    existingEmails.some((value) => value.toLowerCase() === validation.data.email.toLowerCase());
  const selectedRoles = inviteRoles.filter((role) => roles[role]);
  const canSend =
    validation.success &&
    !duplicate &&
    failure !== "rolesRejected" &&
    (!roles.center_manager || canManageManagers);
  const effects: string[] = [t(($) => $.settings.teamEditor.inviteEffect)];
  if (selectedRoles.length) {
    const labels = selectedRoles.map((role) => t(($) => $.settings.teamNative.roles[role]));
    effects.push(t(($) => $.settings.teamNative.effectAdd, { role: labels.join(", ") }));
    effects.push(
      roles.center_manager
        ? t(($) => $.settings.teamNative.centerManagerEffect)
        : t(($) => $.settings.teamEditor.staffInviteEffect),
    );
  }
  async function send() {
    if (running.current || !validation.success || (!canSend && !uncertain)) return;
    const current = attempt.current ?? {
      create: personCreateIntent(scope, validation.data),
      inviteKey: uuidv7(),
      roles: selectedRoles,
    };
    attempt.current = current;
    running.current = true;
    setBusy(true);
    let stage: "invite" | "roles" | "job" = "invite";
    try {
      if (!current.job) {
        current.createdId ??= await createPerson(current.create);
        if (!mounted.current) return;
        setCreated(true);
        const person = await readPerson(current.create.scope, current.createdId);
        const recipient = person.contacts?.filter((contact) => contact.kind === "email") ?? [];
        if (
          recipient.length !== 1 ||
          recipient[0]?.value.toLowerCase() !== current.create.email.toLowerCase()
        )
          throw Error("INVITATION_RECIPIENT_CHANGED");
        if (!mounted.current) return;
        current.remaining ??= current.roles.map((role) =>
          teamRoleAssignment(current.create.scope, person.id, role),
        );
        current.job = await sendPersonInvitation({
          scope: current.create.scope,
          personId: person.id,
          key: current.inviteKey,
        });
      }
      if (!mounted.current) return;
      stage = "roles";
      for (const assignment of current.remaining ?? []) {
        const receipt = await writeTeam(assignment);
        if (!receipt.primary_id) throw Error("TEAM_RESULT_UNAVAILABLE");
        if (!mounted.current) return;
        current.remaining = current.remaining?.slice(1);
      }
      stage = "job";
      const job = await readPersonInvitationJob(current.create.scope, current.job);
      if (job.id !== current.job.job_id) throw Error("INVITATION_READ_UNAVAILABLE");
      if (mounted.current) onQueued(job.state);
    } catch (error) {
      if (!mounted.current) return;
      const accessLost = onAccessLost(error);
      const definite =
        accessLost ||
        (error instanceof BackendError &&
          !error.retryable &&
          ![
            "TRANSPORT_ERROR",
            "OPERATION_IN_PROGRESS",
            "OPERATION_RESULT_EXPIRED",
            "IDEMPOTENCY_PAYLOAD_MISMATCH",
          ].includes(error.code)) ||
        (error instanceof Error && error.message === "INVITATION_RECIPIENT_CHANGED");
      if (stage === "roles") setFailure(definite ? "rolesRejected" : "roleUnread");
      else if (stage === "job") setFailure(accessLost ? "rejected" : "jobUnread");
      else {
        setFailure(definite ? "rejected" : "inviteUnread");
        if (definite && !current.createdId) attempt.current = undefined;
        if (definite && current.createdId) current.inviteKey = uuidv7();
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const error = failure
    ? {
        rejected: t(($) => $.people.writeRejected),
        inviteUnread: t(($) => $.settings.teamEditor.inviteUnread),
        roleUnread: t(($) => $.settings.teamEditor.inviteRoleUnread),
        rolesRejected: t(($) => $.settings.teamEditor.inviteRolesRejected),
        jobUnread: t(($) => $.people.jobUnread),
      }[failure]
    : duplicate
      ? t(($) => $.settings.teamEditor.duplicateEmail)
      : validation.error?.issues[0]?.message;
  return (
    <TeamSheet
      open
      invite
      title={t(($) => $.settings.invite)}
      description={t(($) => $.settings.teamNative.inviteDescription)}
      identity={{ name, email }}
      onNameChange={created ? undefined : setName}
      onEmailChange={created ? undefined : setEmail}
      roles={inviteRoles.map((role) => ({
        key: role,
        label: t(($) => $.settings.teamNative.roles[role]),
        description:
          role === "center_manager"
            ? t(($) => $.settings.teamNative.centerManagerDescription)
            : t(($) => $.settings.teamNative.staffDescription),
        selected: roles[role],
        writable: !created && (role !== "center_manager" || canManageManagers),
      }))}
      rolesUnread={false}
      effects={effects}
      onRole={(role, selected) => {
        if (role === "center_manager" || role === "staff") {
          setRoles((previous) => ({ ...previous, [role]: selected }));
        }
      }}
      onReview={() => {
        void send();
      }}
      onClose={onClose}
      dirty={canSend}
      submitLabel={t(($) => $.settings.teamEditor.sendInvite)}
      error={error}
      locked={locked}
      canCheckResult={uncertain && !busy}
    />
  );
}
