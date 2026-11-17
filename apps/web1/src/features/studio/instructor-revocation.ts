import { v7 as uuidv7 } from "uuid";
import { studioBackend, type StudioScope } from "./studio";
import { readStudioInstructors, type InstructorRecord } from "./studio-reads";
import type { InstructorRevocationPreview } from "../../lib/api-contracts/generated";

export interface InstructorRevocationIntent {
  scope: StudioScope;
  preview: InstructorRevocationPreview;
  reason: string;
  key: string;
}

export async function previewInstructorRevocation(scope: StudioScope, target: InstructorRecord) {
  const records = await readStudioInstructors(scope, target.person.id);
  const latest = records.find((item) => item.assignmentId === target.assignmentId && item.active);
  if (!latest) throw new Error("INSTRUCTOR_INACTIVE");
  const backend = await studioBackend(scope);
  const preview = await backend.call("role_revoke_preview_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    assignment_id: latest.assignmentId,
    expected_version: latest.version,
  });
  if (
    preview.assignment_id !== latest.assignmentId ||
    preview.assignment_version !== latest.version ||
    !preview.id ||
    !preview.token
  )
    throw new Error("STUDIO_UNAVAILABLE");
  return preview;
}

export function instructorRevocationIntent(
  scope: StudioScope,
  preview: InstructorRevocationPreview,
  reason: string,
): InstructorRevocationIntent {
  if (!reason.trim()) throw new Error("REASON_REQUIRED");
  // Preview tokens never leave this explicit, in-memory operation intent.
  return { scope: { ...scope }, preview, reason: reason.trim(), key: uuidv7() };
}

export async function revokeInstructor(intent: InstructorRevocationIntent) {
  const backend = await studioBackend(intent.scope);
  const result = await backend.call("role_revoke_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    operation_key: intent.key,
    assignment_id: intent.preview.assignment_id,
    expected_version: intent.preview.assignment_version,
    reason: intent.reason,
    impact_approval: { id: intent.preview.id, token: intent.preview.token },
  });
  if (result.primary_id !== intent.preview.assignment_id) throw new Error("STUDIO_ACK_UNAVAILABLE");
  return result;
}
