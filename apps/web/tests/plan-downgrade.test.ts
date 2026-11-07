import { expect, test, vi } from "vitest";
import { v7 } from "uuid";
import { setupCall } from "../src/lib/studio-setup";
import { readPlanChange, readDowngrade, retainedScopeValid } from "../src/lib/plan-downgrade";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const scope = { actorId: v7(), orgId: v7() },
  id = v7(),
  target = v7();
const row = () => ({
  operation: "subscription_downgrade_request_v1",
  exists: true,
  entity: { type: "saas_subscriptions", id },
  state: "active",
  versions: [{ entity: { type: "saas_subscriptions", id }, version: 9 }],
  current: { operation: "subscription_downgrade_request_v1", values: { target_plan_id: target } },
});
test("downgrade reads actual subscription version with an exact target selector, independent of a center", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({ items: [row()], next_cursor: null } as never);
  expect(await readDowngrade(scope, target)).toBe(9);
  expect(setupCall).toHaveBeenLastCalledWith("management_state_get_v1", {
    org_id: scope.orgId,
    operation: "subscription_downgrade_request_v1",
    selector: { operation: "subscription_downgrade_request_v1", key: { target_plan_id: target } },
  });
});
test.each(["target", "entity", "version", "cursor", "duplicate"])(
  "rejects inconsistent downgrade proof: %s",
  async (kind) => {
    const r = row(),
      p = { items: [r], next_cursor: null };
    if (kind === "target") r.current.values.target_plan_id = v7();
    if (kind === "entity") r.entity.type = "people";
    if (kind === "version") r.versions = [];
    if (kind === "cursor") Object.assign(p, { next_cursor: "next" });
    if (kind === "duplicate") p.items.push(r);
    vi.mocked(setupCall).mockResolvedValueOnce(p as never);
    await expect(readDowngrade(scope, target)).rejects.toThrow("invalidPlanChange");
  },
);
test("cancellation requires the exact pending request and its own version rather than subscription version", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [
      {
        operation: "subscription_change_cancel_v1",
        exists: true,
        entity: { type: "saas_change_requests", id },
        state: "scheduled",
        versions: [{ entity: { type: "saas_change_requests", id }, version: 3 }],
        current: { operation: "subscription_change_cancel_v1", values: { change_id: id } },
      },
    ],
    next_cursor: null,
  } as never);
  expect(await readPlanChange(scope, id)).toBe(3);
});
test("retention rejects foreign catalog values, duplicates and a 101st student without choosing resources automatically", () => {
  const resources = { rooms: [{ id }], disciplines: [{ id }], instructors: [{ id }] };
  const chosen = { room_id: id, discipline_id: id, instructor_id: id, student_person_ids: [id] };
  expect(retainedScopeValid(chosen, resources)).toBe(true);
  expect(retainedScopeValid({ ...chosen, room_id: v7() }, resources)).toBe(false);
  expect(retainedScopeValid({ ...chosen, student_person_ids: [id, id] }, resources)).toBe(false);
  expect(
    retainedScopeValid(
      { ...chosen, student_person_ids: Array.from({ length: 101 }, () => v7()) },
      resources,
    ),
  ).toBe(false);
  expect(retainedScopeValid({ ...chosen, room_id: null }, resources)).toBe(false);
  expect(
    retainedScopeValid(
      { room_id: null, discipline_id: null, instructor_id: null, student_person_ids: [] },
      { rooms: [], disciplines: [], instructors: [] },
    ),
  ).toBe(true);
});

test("student discovery rejects inactive/foreign relationships and preserves subscriber number query", async () => {
  const { readRetainedStudents } = await import("../src/lib/plan-downgrade"),
    center = v7();
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [
      {
        id,
        display_name: "Synthetic",
        subscriber_number: 1061,
        relationships: [{ center_id: center, kind: "student", state: "active" }],
      },
      { id: target, relationships: [{ center_id: v7(), kind: "student", state: "active" }] },
      { id: v7(), relationships: [{ center_id: center, kind: "student", state: "inactive" }] },
    ],
    next_cursor: null,
  } as never);
  const p = await readRetainedStudents({ ...scope, centerId: center }, "1061");
  expect(p.items.map((p) => p.id)).toEqual([id]);
  expect(setupCall).toHaveBeenLastCalledWith("people_list_v1", {
    org_id: scope.orgId,
    center_id: center,
    relationship: "student",
    query: "1061",
    page: { limit: 25, sort: "created_at_asc" },
  });
});
