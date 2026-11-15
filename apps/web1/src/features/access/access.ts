import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { readPerson, sendPersonInvitation, type PersonInvitationIntent } from "../people/people";
import type { PersonView, ManagementStateView, JobRef } from "../../lib/api-contracts/generated";
import type { AccessAction } from "./access-view";

export interface AccessActionBase {
  scope: ClientScope;
  selection: AccessAction;
  person: PersonView;
  target: ManagementStateView | null;
  actionable: boolean;
  version: number | null;
  targetId: string | null;
}
export type AccessWriteIntent =
  | { kind: "invite"; invitation: PersonInvitationIntent }
  | {
      kind: "cancel" | "unlink";
      scope: ClientScope;
      targetId: string;
      version: number;
      key: string;
      reason: string;
    };

export async function readAccessAction(
  scope: ClientScope,
  selection: AccessAction,
): Promise<AccessActionBase> {
  const source = "invitation" in selection ? selection.invitation : selection.account;
  const person = await readPerson(scope, source.personId);
  if (selection.kind === "resend" || selection.kind === "invite")
    return {
      scope: { ...scope },
      selection,
      person,
      target: null,
      // Visible contacts are not authority to send, and missing contact
      // visibility must not override an allowed server-provided action.
      actionable:
        selection.kind === "resend" ? selection.invitation.canResend : selection.account.canInvite,
      version: null,
      targetId: null,
    };
  const backend = await scopedBackend(scope);
  const targetId = selection.kind === "cancel" ? selection.invitation.id : selection.account.linkId;
  if (!targetId) throw new Error("ACCESS_TARGET_UNAVAILABLE");
  // By-ID compatibility reads do not contain field/action metadata. The
  // published person selector supplies it; page only this explicitly selected
  // person's history and stop once the selected domain record is found.
  const selector =
    selection.kind === "cancel"
      ? { operation: "account_access_revoke_v1" as const, key: { person_id: source.personId } }
      : { operation: "account_link_remove_v1" as const, key: { person_id: source.personId } };
  const operation = selector.operation;
  let cursor: string | undefined;
  let target: ManagementStateView | undefined;
  do {
    const page = await backend.call("management_state_get_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation,
      selector,
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    const matches = page.items.filter((item) => item.entity?.id === targetId);
    if (matches.length > 1) throw new Error("ACCESS_TARGET_UNAVAILABLE");
    target = matches[0];
    if (target) break;
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  if (!target) throw new Error("ACCESS_TARGET_UNAVAILABLE");
  const entityType = selection.kind === "cancel" ? "invitations" : "account_links";
  if (target.operation !== selector.operation || target.current?.operation !== selector.operation)
    throw new Error("ACCESS_TARGET_UNAVAILABLE");
  if (!target.exists)
    return {
      scope: { ...scope },
      selection,
      person,
      target,
      actionable: false,
      version: null,
      targetId,
    };
  if (
    target.current.operation === "account_access_revoke_v1" &&
    target.current.values.center_id !== scope.centerId
  )
    throw new Error("ACCESS_TARGET_UNAVAILABLE");
  const values = target.current.values;
  const returnedId =
    "invitation_id" in values
      ? values.invitation_id
      : "link_id" in values
        ? values.link_id
        : undefined;
  if (
    target.entity?.type !== entityType ||
    target.entity.id !== targetId ||
    returnedId !== targetId ||
    !values.person_id ||
    ![person.id, ...(person.linked_person_ids ?? [])].includes(values.person_id)
  )
    throw new Error("ACCESS_TARGET_UNAVAILABLE");
  const versions = target.versions.filter(
    (entry) => entry.entity.type === entityType && entry.entity.id === targetId,
  );
  if (versions.length !== 1 || !versions[0]?.version) throw new Error("ACCESS_TARGET_UNAVAILABLE");
  return {
    scope: { ...scope },
    selection,
    person,
    target,
    actionable: values.actionable === true,
    version: versions[0].version,
    targetId,
  };
}
export function accessWriteIntent(base: AccessActionBase, reason: string): AccessWriteIntent {
  if (!base.actionable) throw new Error("ACCESS_ACTION_UNAVAILABLE");
  if (base.selection.kind === "invite" || base.selection.kind === "resend")
    return {
      kind: "invite",
      invitation: { scope: { ...base.scope }, personId: base.person.id, key: uuidv7() },
    };
  if (!base.version || !base.targetId) throw new Error("ACCESS_TARGET_UNAVAILABLE");
  const validReason =
    base.selection.kind === "unlink"
      ? z.string().trim().min(1, "REASON_REQUIRED").parse(reason)
      : "";
  return {
    kind: base.selection.kind,
    scope: { ...base.scope },
    targetId: base.targetId,
    version: base.version,
    key: uuidv7(),
    reason: validReason,
  };
}
export async function writeAccessAction(intent: AccessWriteIntent): Promise<{ job?: JobRef }> {
  if (intent.kind === "invite") return { job: await sendPersonInvitation(intent.invitation) };
  const backend = await scopedBackend(intent.scope);
  const common = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    expected_version: intent.version,
  };
  const receipt =
    intent.kind === "cancel"
      ? await backend.call("account_access_revoke_v1", {
          ...common,
          invitation_id: intent.targetId,
        })
      : await backend.call("account_link_remove_v1", {
          ...common,
          link_id: intent.targetId,
          reason: intent.reason,
        });
  if (receipt.primary_id !== intent.targetId) throw new Error("ACCESS_ACK_UNAVAILABLE");
  return {};
}
