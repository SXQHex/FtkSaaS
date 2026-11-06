import type { AttendanceView, SessionView, Preview } from "@ftksaas/api-contracts";
import type { AttendanceApi } from "../src/lib/attendance";
export const id = "019a2b3c-4d5e-7000-8000-000000000001",
  reservation = "019a2b3c-4d5e-7000-8000-000000000002",
  person = "019a2b3c-4d5e-7000-8000-000000000003";
export const scope = { actorId: id, orgId: id, centerId: reservation };
export const session: SessionView = {
  id,
  class_id: null,
  discipline_id: id,
  format: "group",
  starts_at: "2026-01-01T10:00:00Z",
  ends_at: "2026-01-01T11:00:00Z",
  state: "planned",
  attendance_state: "open",
  assignments: [{ person_id: id, duty: "instructor" }],
  version: 8,
  capacity: {
    total: 8,
    held: 1,
    remaining: 7,
    category_held: null,
    category_remaining: null,
    room_capacity: 8,
  },
};
export const view: AttendanceView = {
  session_id: id,
  closure_state: "open",
  revision: 0,
  session_version: 8,
  actual_started_at: null,
  entries: [
    {
      reservation_id: reservation,
      person_id: person,
      result: "unmarked",
      version: 7,
      protected: true,
      eligibility_snapshot: null,
      subscriber_number: "1001",
    },
  ],
};
export const preview: Preview = {
  id,
  token: "synthetic-attendance",
  scope_hash: "synthetic",
  expires_at: "2099-01-01T00:00:00Z",
  dependencies: {
    versions: [{ entity: { type: "sessions", id }, version: 8 }],
    policy_hashes: [],
    permission_hash: "synthetic",
  },
  effects: [
    {
      entity: { type: "reservations", id: reservation },
      action: "adjust",
      quantity: 1,
      reason: "Backend hak düzeltmesi",
    },
  ],
  blockers: [],
};
export const makeApi = (): AttendanceApi => ({
  read: async () => ({ session, view }),
  access: async () => false,
  preview: async () => preview,
  rights: async (_scope, source) =>
    [...new Set(source.entries.map((row) => row.person_id))].map((personId) => ({
      personId,
      rows: [],
    })),
});
