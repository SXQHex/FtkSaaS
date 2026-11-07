import { expect, test, vi } from "vitest";
import { v7 } from "uuid";
import { setupCall } from "../src/lib/studio-setup";
import { readChangeInventory, partitionChange } from "../src/lib/sale-change";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  sale = v7(),
  person = v7(),
  id = v7(),
  parent = v7();
function page() {
  return {
    as_of: "2026-11-07T00:00:00Z",
    next_cursor: null,
    sale_change_context: { entity: { type: "sales", id: sale }, version: 8 },
    items: [
      {
        operation: "sale_change_preview_v1",
        exists: true,
        state: "reserved",
        entity: { type: "reservations", id },
        versions: [
          { entity: { type: "sales", id: sale }, version: 8 },
          { entity: { type: "reservations", id }, version: 3 },
          { entity: { type: "sessions", id: parent }, version: 2 },
        ],
        current: { operation: "sale_change_preview_v1", values: { sale_id: sale } },
        sale_change_record: {
          person_id: person,
          center_id: scope.centerId,
          parent: { type: "sessions", id: parent },
          starts_at: "2027-01-01T12:00:00Z",
        },
      },
    ],
  };
}
test("exact source inventory requires explicit exhaustive keep/cancel, never reserved counts", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce(page() as never);
  const p = await readChangeInventory(scope, sale, person);
  expect(p.records.map((r) => r.id)).toEqual([id]);
  expect(() => partitionChange(p, {})).toThrow("invalidSaleChange");
  expect(partitionChange(p, { [id]: "keep" })).toEqual({
    keep_reservation_ids: [id],
    cancel_reservation_ids: [],
  });
});
test.each(["person", "sale", "parent", "duplicate", "version"])(
  "invalid source inventory is rejected: %s",
  async (kind) => {
    const p = page(),
      r = p.items[0]!;
    if (kind === "person") r.sale_change_record.person_id = v7();
    if (kind === "sale") r.current.values.sale_id = v7();
    if (kind === "parent") r.sale_change_record.parent.id = v7();
    if (kind === "duplicate") p.items.push(r);
    if (kind === "version") p.sale_change_context.version = 0;
    vi.mocked(setupCall).mockResolvedValueOnce(p as never);
    await expect(readChangeInventory(scope, sale, person)).rejects.toThrow("invalidSaleChange");
  },
);
test("cursor source drift discards the partial inventory", async () => {
  const p = page();
  vi.mocked(setupCall)
    .mockResolvedValueOnce({ ...p, next_cursor: "next" } as never)
    .mockResolvedValueOnce({
      ...p,
      items: [],
      sale_change_context: { ...p.sale_change_context, version: 9 },
    } as never);
  await expect(readChangeInventory(scope, sale, person)).rejects.toThrow("invalidSaleChange");
});
