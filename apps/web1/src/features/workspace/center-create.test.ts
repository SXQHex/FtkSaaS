import { beforeEach, expect, it, vi } from "vitest";
import {
  centerCreateIntent,
  writeCenter,
  centerCreateReceipt,
  readCreatedCenter,
} from "./center-create";
const { call, workspace, scoped } = vi.hoisted(() => ({
  call: vi.fn(),
  workspace: vi.fn(),
  scoped: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: scoped }));
vi.mock("./workspace", () => ({ readWorkspace: workspace }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2) };
const draft = { name: "  İlk merkez  ", timezone: "Europe/Istanbul" };
beforeEach(() => {
  call.mockReset();
  workspace.mockReset();
  scoped.mockReset().mockResolvedValue({ call });
});
it("requires a named center and an explicitly selected real zone without inventing a default", () => {
  expect(() => centerCreateIntent(scope, { name: " ", timezone: "" })).toThrow();
  expect(() => centerCreateIntent(scope, { name: "Merkez", timezone: "GMT+03" })).toThrow();
  expect(centerCreateIntent(scope, { name: "Merkez", timezone: "UTC" }).timezone).toBe("UTC");
});
it("pins the domain account, org-only payload and exact creation key across retry", async () => {
  const intent = centerCreateIntent(scope, draft);
  call.mockResolvedValue({ primary_id: id(3) });
  await writeCenter(intent);
  await writeCenter(intent);
  expect(scoped).toHaveBeenCalledWith(scope);
  const first = call.mock.calls[0]![1],
    second = call.mock.calls[1]![1];
  expect(first).toMatchObject({
    org_id: scope.orgId,
    name: "İlk merkez",
    timezone: draft.timezone,
    operation_key: intent.key,
  });
  expect(second.operation_key).toBe(first.operation_key);
  expect(second.request_id).not.toBe(first.request_id);
  expect(first).not.toHaveProperty("center_id");
  expect(first).not.toHaveProperty("expected_version");
});
it("rejects a foreign receipt instead of treating another operation as center success", async () => {
  const intent = centerCreateIntent(scope, draft);
  call.mockResolvedValue({
    operation: "center_create_v1",
    key: id(5),
    result_reference: { type: "centers", id: id(3) },
  });
  await expect(centerCreateReceipt(intent)).rejects.toThrow("CENTER_RECEIPT_UNAVAILABLE");
  call.mockResolvedValue({
    operation: "center_create_v1",
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "centers", id: id(3) },
  });
  await expect(centerCreateReceipt(intent)).resolves.toMatchObject({ key: intent.key });
});
it("requires the acknowledged center identity, name, zone and org on reread, not an arbitrary first center", async () => {
  const intent = centerCreateIntent(scope, draft),
    center = { id: id(3), name: "İlk merkez", timezone: draft.timezone, state: "active" };
  workspace.mockResolvedValue({ selected: { id: scope.orgId }, centers: [center] });
  await expect(readCreatedCenter(intent, center.id)).resolves.toMatchObject({ center });
  await expect(readCreatedCenter(intent)).rejects.toThrow("CENTER_RESULT_UNAVAILABLE");
  await expect(readCreatedCenter(intent, id(9))).rejects.toThrow("CENTER_RESULT_UNAVAILABLE");
  workspace.mockResolvedValue({ selected: { id: id(9) }, centers: [center] });
  await expect(readCreatedCenter(intent, center.id)).rejects.toThrow("CENTER_RESULT_UNAVAILABLE");
});
