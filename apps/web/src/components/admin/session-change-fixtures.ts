// Fictional fixtures for /tasarim only; never a fallback for a live API error.
import type { Preview, SessionView } from "@ftksaas/api-contracts";
import type { SessionChangeActions } from "../calendar/session-change";

export const sampleSession: SessionView = {
  id: "019a2b3c-4d5e-7000-8000-000000000011",
  class_id: null,
  discipline_id: "019a2b3c-4d5e-7000-8000-000000000012",
  format: "group",
  starts_at: "2030-10-29T15:00:00Z",
  ends_at: "2030-10-29T16:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  version: 1,
  capacity: {
    total: 20,
    categories: null,
    held: 12,
    remaining: 8,
    category_held: null,
    category_remaining: null,
    room_capacity: 30,
  },
};
export function samplePreview(input: Parameters<SessionChangeActions["preview"]>[0]): Preview {
  const interval = input.patch.interval ?? {
    starts_at: sampleSession.starts_at,
    ends_at: sampleSession.ends_at,
  };
  const capacity = input.patch.capacity ?? { total: 20 };
  return {
    id: "019a2b3c-4d5e-7000-8000-000000000013",
    token: "synthetic-preview-token",
    scope_hash: "synthetic",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
    effects: [],
    expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
    blockers:
      capacity.total > 30
        ? [
            {
              code: "CAPACITY_FULL",
              retryable: false,
              trace_id: "019a2b3c-4d5e-7000-8000-000000000014",
            },
          ]
        : [],
    sessions: [
      { session_id: sampleSession.id, interval, capacity, resources: [], assignments: [] },
    ],
  };
}
export const sampleChangeActions: SessionChangeActions = {
  preview: async (input) => samplePreview(input),
  apply: async () => ({
    operation_id: "019a2b3c-4d5e-7000-8000-000000000015",
    primary_id: sampleSession.id,
    version: 2,
    replayed: false,
    related: [],
  }),
  status: async (_orgId, key) => ({
    operation: "session_change_apply_v1",
    key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "sessions", id: sampleSession.id },
  }),
};
