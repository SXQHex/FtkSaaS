import { beforeEach, expect, test, vi } from "vitest";
import { getClasses } from "../src/lib/program";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
}));
vi.mock("../src/lib/api", async (load) => ({
  ...(await load<typeof import("../src/lib/api")>()),
  apiClient: () => ({ call: mocks.call }),
}));
const scope = {
  actorId: "actor",
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  centerId: "019a2b3c-4d5e-7000-8000-000000000002",
};
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
});
function row(id: string, version: number) {
  return {
    operation: "class_save_v1",
    entity: { type: "classes", id },
    exists: true,
    state: "active",
    versions: [{ entity: { type: "classes", id }, version }],
    current: {
      operation: "class_save_v1",
      values: { class_id: id, name: "Tango", discipline_id: "discipline", external_open: false },
    },
  };
}
test("class discovery follows the real selector cursor without inventing write versions", async () => {
  mocks.call
    .mockResolvedValueOnce({ ok: true, data: { items: [row("first", 3)], next_cursor: "next" } })
    .mockResolvedValueOnce({ ok: true, data: { items: [row("second", 12)], next_cursor: null } });
  const classes = await getClasses(scope);
  expect(classes.map((r) => r.entity?.id)).toEqual(["first", "second"]);
  expect(mocks.call.mock.calls[0][1]).toMatchObject({
    center_id: scope.centerId,
    operation: "class_save_v1",
    selector: { operation: "class_save_v1", key: {} },
  });
  expect(mocks.call.mock.calls[1][1]).toMatchObject({
    page: { cursor: "next", sort: "created_at_asc" },
  });
});
test("missing class version is not replaced by another entity version", async () => {
  mocks.call.mockResolvedValue({
    ok: true,
    data: {
      items: [
        { ...row("first", 3), versions: [{ entity: { type: "rooms", id: "first" }, version: 17 }] },
      ],
      next_cursor: null,
    },
  });
  await expect(getClasses(scope)).rejects.toThrow("unreadableClass");
});
test("program recovery rejects unknown fields and another center", () => {
  const key = setupStorageKey(scope, "program:class");
  const command = {
    operation: "program_apply_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: "019a2b3c-4d5e-7000-8000-000000000003",
      preview: { id: scope.orgId, token: "test" },
    },
  };
  sessionStorage.setItem(key, JSON.stringify({ command }));
  expect(recoverSetup(scope, "program:class")).toEqual({ command });
  sessionStorage.setItem(
    key,
    JSON.stringify({ command: { ...command, input: { ...command.input, center_id: "other" } } }),
  );
  expect(recoverSetup(scope, "program:class")).toBe("invalid");
  sessionStorage.setItem(
    key,
    JSON.stringify({ command: { ...command, input: { ...command.input, extra: true } } }),
  );
  expect(recoverSetup(scope, "program:class")).toBe("invalid");
});
