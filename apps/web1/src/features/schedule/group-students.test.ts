import { beforeEach, expect, it, vi } from "vitest";
import type { EntitlementView } from "../../lib/api-contracts/generated";
const { call, rights } = vi.hoisted(() => ({ call: vi.fn(), rights: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
vi.mock("../member-profile/profile-read", () => ({ readProfileRights: rights }));
import {
  readGroupStudents,
  priorityIntent,
  writePriority,
  readPriorityReceipt,
  readPriorityResult,
} from "./group-students";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(2), orgId: id(3), centerId: id(4) },
  interval = { starts_at: "2026-11-16T00:00:00Z", ends_at: "2026-11-23T00:00:00Z" };
const sale: EntitlementView = {
  sale_id: id(6),
  person_id: id(5),
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  state: "active",
  available: 8,
  reserved: 0,
  consumed: 0,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
  booking_mode: "priority",
};
const reservation = {
  id: id(7),
  person_id: id(5),
  session_id: id(8),
  mode: "priority",
  state: "active",
  version: 2,
  source_summary: { status: "available", source_sale_id: sale.sale_id },
};
const groupItem = () => ({
  entity: { type: "people", id: id(5) },
  current: null,
  group_student: {
    person_id: id(5),
    display_name: "Örnek kişi",
    reservations: [
      {
        id: id(7),
        version: 2,
        session_id: id(8),
        source_sale_id: id(6),
        mode: "priority",
        state: "active",
        starts_at: "2026-11-15T23:30:00Z",
        ends_at: "2026-11-16T00:30:00Z",
      },
    ],
  },
});
beforeEach(() => vi.resetAllMocks());

it("uses native class discovery and accepts an overlapping lesson across the interval start", async () => {
  call.mockResolvedValueOnce({
    items: [groupItem()],
    next_cursor: "next",
    as_of: interval.starts_at,
  });
  const result = await readGroupStudents(scope, id(9), interval, "  kişi  ", "cursor");
  expect(result.items[0]!.reservations[0]!.id).toBe(id(7));
  expect(result.next_cursor).toBe("next");
  expect(call).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      center_id: scope.centerId,
      operation: "reservation_cancel_v1",
      selector: {
        operation: "reservation_cancel_v1",
        key: { directory: "class", class_id: id(9), interval, status: "active", query: "kişi" },
      },
      page: { limit: 20, cursor: "cursor" },
    }),
  );
});
it("rejects a person-root mismatch or a flexible reservation instead of inventing fixed membership", async () => {
  const wrongPerson = groupItem();
  wrongPerson.entity.id = id(10);
  call.mockResolvedValueOnce({ items: [wrongPerson] });
  await expect(readGroupStudents(scope, id(9), interval)).rejects.toThrow(
    "SCHEDULE_GROUP_UNAVAILABLE",
  );
  const flexible = groupItem();
  flexible.group_student.reservations[0]!.mode = "flexible";
  call.mockResolvedValueOnce({ items: [flexible] });
  await expect(readGroupStudents(scope, id(9), interval)).rejects.toThrow(
    "SCHEDULE_GROUP_UNAVAILABLE",
  );
});
it("pins explicit person, lesson, sale and priority mode without a class-duty or fake version input", async () => {
  const intent = priorityIntent(scope, id(5), id(8), sale);
  expect(intent.request).toMatchObject({
    person_id: id(5),
    session_id: id(8),
    source_sale_id: id(6),
    mode: "priority",
  });
  expect(intent.request).not.toHaveProperty("expected_version");
  expect(() => priorityIntent(scope, id(10), id(8), sale)).toThrow(
    "SCHEDULE_GROUP_SOURCE_UNAVAILABLE",
  );
  call.mockResolvedValueOnce({ primary_id: id(7), changed: [], jobs: [] });
  await writePriority(intent);
  expect(call).toHaveBeenLastCalledWith(
    "reservation_create_v1",
    expect.objectContaining({ operation_key: intent.request.operation_key }),
  );
});
it("requires the receipt operation and key to match the frozen reservation command", async () => {
  const intent = priorityIntent(scope, id(5), id(8), sale);
  call.mockResolvedValueOnce({
    operation: "reservation_cancel_v1",
    key: intent.request.operation_key,
  });
  await expect(readPriorityReceipt(intent)).rejects.toThrow("SCHEDULE_GROUP_RECEIPT_UNAVAILABLE");
});
it("rereads the acknowledged reservation, rights and lesson without another writer", async () => {
  const intent = priorityIntent(scope, id(5), id(8), sale);
  call.mockImplementation(async (operation) =>
    operation === "reservation_list_v1"
      ? { items: [reservation], next_cursor: null }
      : {
          id: id(8),
          version: 3,
          state: "planned",
          capacity: { total: 12, held: 1, remaining: 11 },
        },
  );
  rights.mockResolvedValueOnce([{ ...sale, available: 7, reserved: 1 }]);
  const result = await readPriorityResult(intent, id(7));
  expect(result.reservation).toEqual(reservation);
  expect(result.rights[0]).toMatchObject({ sale_id: sale.sale_id, available: 7, reserved: 1 });
  expect(result.session.capacity).toEqual({ total: 12, held: 1, remaining: 11 });
  expect(call).toHaveBeenCalledWith(
    "reservation_list_v1",
    expect.objectContaining({ include_source_summary: true }),
  );
  expect(rights).toHaveBeenCalledWith(scope, id(5));
  expect(call.mock.calls.map(([operation]) => operation)).toEqual([
    "reservation_list_v1",
    "session_get_v1",
  ]);
});
it.each([undefined, { status: "restricted" }, { status: "available", source_sale_id: id(10) }])(
  "keeps the result unverified without the exact reservation source (%j)",
  async (source_summary) => {
    const intent = priorityIntent(scope, id(5), id(8), sale);
    call.mockResolvedValueOnce({
      items: [{ ...reservation, source_summary }],
      next_cursor: null,
    });
    await expect(readPriorityResult(intent, id(7))).rejects.toThrow(
      "SCHEDULE_GROUP_RESULT_UNAVAILABLE",
    );
    expect(rights).not.toHaveBeenCalled();
  },
);
