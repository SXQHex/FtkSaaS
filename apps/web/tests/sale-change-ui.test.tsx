import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { SaleChange } from "../src/components/products/sale-change";
import tr from "../messages/tr.json";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: unknown) => Promise<unknown>>(),
  send: vi.fn<(input: unknown) => Promise<unknown>>(),
  rights: vi.fn<() => Promise<unknown>>(),
  products: vi.fn<() => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
  sendSetupCommand: m.send,
}));
vi.mock("../src/lib/products", () => ({ readEntitlements: m.rights, listProducts: m.products }));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  person = v7(),
  sale = v7(),
  target = v7(),
  reservation = v7(),
  session = v7(),
  preview = v7();
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  m.rights.mockResolvedValue([
    {
      sale_id: sale,
      person_id: person,
      sale_state: "active",
      start_date: "2027-01-01",
      end_date: "2027-02-01",
      timezone: "Europe/Istanbul",
    },
  ]);
  m.products.mockResolvedValue({
    items: [{ id: v7(), version_id: target, terms: { name: "Yeni paket" } }],
    next_cursor: null,
  });
  m.send.mockResolvedValue({});
  m.call.mockImplementation(async (op, input) =>
    op === "management_state_get_v1"
      ? {
          sale_change_context: { entity: { type: "sales", id: sale }, version: 8 },
          as_of: "2026-11-07T00:00:00Z",
          next_cursor: null,
          items: [
            {
              operation: "sale_change_preview_v1",
              exists: true,
              entity: { type: "reservations", id: reservation },
              versions: [
                { entity: { type: "sales", id: sale }, version: 8 },
                { entity: { type: "sessions", id: session }, version: 2 },
                { entity: { type: "reservations", id: reservation }, version: 1 },
              ],
              current: { operation: "sale_change_preview_v1", values: { sale_id: sale } },
              sale_change_record: {
                person_id: person,
                center_id: scope.centerId,
                parent: { type: "sessions", id: session },
                starts_at: "2027-01-10T12:00:00Z",
              },
            },
          ],
        }
      : {
          id: preview,
          token: "synthetic",
          expires_at: "2099-01-01T00:00:00Z",
          blockers: [],
          warnings: [],
          effects: [],
          dependencies: { versions: [{ entity: { type: "sales", id: sale }, version: 8 }] },
          sale_lifecycle: {
            refund: {
              currency: "TRY",
              calculated_minor: "200",
              debt_reduction_minor: "50",
              credit_added_minor: "150",
              debts: [],
              consumed: 0,
              unused: 4,
              paid_days: 0,
              method: "credit_ratio",
            },
            offset_minor: "20",
            gap_days: 0,
            overlap_days: 1,
            previous_sale_id: sale,
            product_version_id: target,
            start_date: (input as Record<string, string>).start_date,
            end_date: (input as Record<string, string>).end_date,
          },
        },
  );
});
test("package change previews the complete explicit set, requires separate approval, and writes only native proof", async () => {
  const u = userEvent.setup();
  render(<SaleChange scope={scope} personId={person} onSaved={() => undefined} />);
  await u.click(screen.getByRole("button", { name: tr.saleChange.title }));
  await u.selectOptions(await screen.findByLabelText(tr.saleChange.source), sale);
  await u.selectOptions(await screen.findByLabelText(/Rezervasyon 1/), "keep");
  await u.selectOptions(screen.getByLabelText(tr.saleChange.target), target);
  await u.type(screen.getByLabelText(tr.saleChange.start), "2027-01-01");
  await u.type(screen.getByLabelText(tr.saleChange.end), "2027-02-01");
  await u.type(screen.getByLabelText(tr.saleChange.reason), "Paket tercihi");
  await u.click(screen.getByRole("button", { name: tr.saleChange.review }));
  const review = await screen.findByRole("region", { name: tr.flows.review });
  expect(m.send).not.toHaveBeenCalled();
  expect(review).toHaveTextContent(tr.saleChange.creditAdded);
  expect(review).toHaveTextContent(/1,50/);
  expect(m.call.mock.calls.find(([op]) => op === "sale_change_preview_v1")?.[1]).toMatchObject({
    sale_id: sale,
    keep_reservation_ids: [reservation],
    cancel_reservation_ids: [],
    new_product_version_id: target,
  });
  await u.click(within(review).getByRole("checkbox"));
  await u.click(within(review).getByRole("button", { name: tr.flows.apply }));
  await waitFor(() =>
    expect(m.send).toHaveBeenCalledWith({
      operation: "sale_change_apply_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: expect.any(String),
        preview: { id: preview, token: "synthetic" },
      },
    }),
  );
});
