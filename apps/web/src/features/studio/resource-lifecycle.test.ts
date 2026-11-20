import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagementStateView } from "@ftksaas/api-contracts";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("./studio", () => ({ studioBackend: vi.fn(async () => ({ call })) }));
import {
  readResourceLifecycle,
  resourceLifecycleIntent,
  writeResourceLifecycle,
  rereadResourceLifecycle,
  type ResourceLifecycleSelection,
} from "./resource-lifecycle";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
const personId = "019a7b00-0000-7000-8000-000000000006";
const id = "019a7b00-0000-7000-8000-000000000011";
const selection = (kind: "rule" | "closure"): ResourceLifecycleSelection => ({
  kind,
  id,
  resource: { kind: "person", id: personId },
  label: "Fixture",
});
function record(kind: "rule" | "closure", active = true, version = 3): ManagementStateView {
  const entity = {
    type: kind === "rule" ? ("availability_rules" as const) : ("availability_exceptions" as const),
    id,
  };
  const resource = { kind: "person" as const, id: personId };
  return {
    operation: kind === "rule" ? "availability_save_v1" : "availability_exception_save_v1",
    entity,
    exists: true,
    state: active ? "active" : kind === "rule" ? "inactive" : "cancelled",
    as_of: "2026-11-15T00:00:00Z",
    versions: [
      { entity: kind === "rule" ? entity : { type: "centers", id: scope.centerId }, version },
    ],
    current:
      kind === "rule"
        ? {
            operation: "availability_save_v1",
            values: {
              resource,
              rule_id: id,
              rule: {
                weekdays: [1, 3],
                local_start: "18:00:00",
                local_end: "19:00:00",
                valid_from: "2026-11-01",
              },
            },
          }
        : {
            operation: "availability_exception_save_v1",
            values: {
              resource,
              exception_id: id,
              interval: { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-02T00:00:00Z" },
            },
          },
  };
}
const page = (item: ManagementStateView) => ({
  items: [item],
  next_cursor: null,
  as_of: item.as_of,
});
beforeEach(() => {
  call.mockReset();
});
describe("resource lifecycle authority", () => {
  it.each(["rule", "closure"] as const)(
    "uses the exact %s version and omits save-only fields",
    async (kind) => {
      const item = record(kind, true, 17);
      item.versions.push({
        entity: kind === "rule" ? { type: "centers", id: scope.centerId } : item.entity!,
        version: 99,
      });
      call.mockResolvedValueOnce(page(item));
      const base = await readResourceLifecycle(scope, selection(kind));
      expect(base.version).toBe(17);
      const intent = resourceLifecycleIntent(base, "  Kontrollü gerekçe  ");
      call.mockResolvedValue({ primary_id: id });
      await writeResourceLifecycle(intent);
      await writeResourceLifecycle(intent);
      const first = call.mock.calls[1]!,
        second = call.mock.calls[2]!;
      expect(first[1]).toMatchObject({
        expected_version: 17,
        reason: "Kontrollü gerekçe",
        action: kind === "rule" ? "retire" : "cancel",
        operation_key: intent.key,
      });
      expect(first[1]).not.toHaveProperty("rule");
      expect(first[1]).not.toHaveProperty("interval");
      expect(second[1].operation_key).toBe(first[1].operation_key);
    },
  );
  it.each(["rule", "closure"] as const)(
    "never treats an already closed %s as a fresh writer base",
    async (kind) => {
      call.mockResolvedValue(page(record(kind, false)));
      const base = await readResourceLifecycle(scope, selection(kind));
      expect(() => resourceLifecycleIntent(base, "Reason")).toThrow("STUDIO_LIFECYCLE_CLOSED");
      expect(call).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["rule", "closure"] as const)(
    "requires closed state and increasing version after %s acknowledgement",
    async (kind) => {
      call.mockResolvedValueOnce(page(record(kind)));
      const intent = resourceLifecycleIntent(
        await readResourceLifecycle(scope, selection(kind)),
        "Reason",
      );
      call.mockResolvedValueOnce(page(record(kind, true, 4)));
      await expect(rereadResourceLifecycle(intent)).rejects.toThrow("STUDIO_LIFECYCLE_UNREAD");
      call.mockResolvedValueOnce(page(record(kind, false, 3)));
      await expect(rereadResourceLifecycle(intent)).rejects.toThrow("STUDIO_LIFECYCLE_UNREAD");
      call.mockResolvedValueOnce(page(record(kind, false, 4)));
      expect((await rereadResourceLifecycle(intent)).active).toBe(false);
    },
  );
  it("rejects a center version belonging to another scope", async () => {
    const item = record("closure");
    item.versions[0]!.entity.id = personId;
    call.mockResolvedValue(page(item));
    await expect(readResourceLifecycle(scope, selection("closure"))).rejects.toThrow(
      "STUDIO_UNAVAILABLE",
    );
  });
  it("rejects missing review details and an empty reason", async () => {
    const item = record("rule");
    if (item.current?.operation !== "availability_save_v1") throw new Error("fixture");
    delete item.current.values.rule;
    call.mockResolvedValueOnce(page(item));
    await expect(readResourceLifecycle(scope, selection("rule"))).rejects.toThrow(
      "STUDIO_UNAVAILABLE",
    );
    call.mockResolvedValueOnce(page(record("rule")));
    const base = await readResourceLifecycle(scope, selection("rule"));
    expect(() => resourceLifecycleIntent(base, "   ")).toThrow();
  });
});
