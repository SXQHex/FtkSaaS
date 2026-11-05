import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Preview, ProductView, EntitlementView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { PersonSales } from "../src/components/products/person-sales";
import { salesApi, renewalMatches, type SalesApi, type RenewalInput } from "../src/lib/sales";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081",
  scope = { actorId: id, orgId: other, centerId: id };
const product: ProductView = {
  id,
  version_id: other,
  terms: {
    name: "Salsa Yeni",
    kind: "credits",
    credits: 8,
    booking_mode: "flexible",
    price_minor: "12345",
    currency: "TRY",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "none" },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: id,
        discipline_id: id,
        usage_targets: ["lesson"],
      },
    ],
  },
};
const right: EntitlementView = {
  sale_id: id,
  person_id: other,
  kind: "credits",
  state: "active",
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  available: 1,
  reserved: 1,
  consumed: 6,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
};
const draft: RenewalInput = {
  previous_sale_id: id,
  product_version_id: other,
  start_date: "2027-01-01",
  end_date: "2027-02-01",
};
function preview(input: RenewalInput): Preview {
  return {
    id,
    token: "synthetic-preview",
    expires_at: "2099-01-01T00:00:00Z",
    scope_hash: "synthetic",
    dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
    effects: [
      { entity: { type: "sales", id }, action: "create", amount_minor: "12345", currency: "TRY" },
    ],
    blockers: [],
    sale_lifecycle: {
      ...input,
      previous_end_date: "2026-12-01",
      gap_days: 31,
      overlap_days: 0,
      refund: null,
      offset_minor: "0",
    },
  };
}
function api(): SalesApi {
  return {
    ...salesApi,
    products: vi
      .fn<SalesApi["products"]>()
      .mockResolvedValue({ items: [product], next_cursor: null, as_of: "2026-11-05T00:00:00Z" }),
    rights: vi.fn<SalesApi["rights"]>().mockResolvedValue([right]),
    preview: vi
      .fn<SalesApi["preview"]>()
      .mockImplementation(async (_scope, input) => preview(input)),
    finance: vi.fn<SalesApi["finance"]>().mockResolvedValue({
      person_id: other,
      currency: "TRY",
      debts: [],
      credit_available_minor: "0",
      movements: { items: [], next_cursor: null, as_of: "2026-11-05T00:00:00Z" },
    }),
  };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Satış ve yenilemeyi aç" }));
  await user.selectOptions(await screen.findByRole("combobox", { name: "Yenilenecek satış" }), id);
  await user.selectOptions(screen.getByRole("combobox", { name: "Yeni ürün sürümü" }), other);
  await user.type(screen.getByLabelText("Başlangıç tarihi"), "2027-01-01");
  await user.type(screen.getByLabelText("Bitiş tarihi"), "2027-02-01");
  await user.click(screen.getByRole("button", { name: "Yenilemeyi incele" }));
}
test("renewal previews exact selected source/version/dates and rereads rights and finance after explicit apply", async () => {
  const reads = api(),
    user = userEvent.setup(),
    bodies: Record<string, unknown>[] = [],
    saved = vi.fn<() => void>();
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/sale_renew_apply_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { operation_id: id, primary_id: other, replayed: false, related: [] },
          trace_id: id,
        });
      },
    ),
  );
  render(<PersonSales scope={scope} personId={other} api={reads} onSaved={saved} />);
  expect(reads.products).not.toHaveBeenCalled();
  await fill(user);
  await screen.findByText(/Aradaki gün: 31/);
  expect(reads.preview).toHaveBeenCalledWith(scope, draft);
  expect(bodies).toHaveLength(0);
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(reads.rights).toHaveBeenCalledTimes(2));
  expect(reads.finance).toHaveBeenCalledWith(scope, other, "TRY");
  expect(saved).toHaveBeenCalledOnce();
  expect(bodies[0]).toMatchObject({
    org_id: other,
    center_id: id,
    preview: { id, token: "synthetic-preview" },
  });
});
test.each(["empty", "changed", "currency"])("%s renewal evidence is not accepted", async (mode) => {
  const reads = api(),
    user = userEvent.setup();
  vi.mocked(reads.preview).mockImplementation(async (_scope, input) => {
    const result = preview(input);
    if (mode === "empty") result.effects = [];
    if (mode === "changed") result.sale_lifecycle!.previous_sale_id = other;
    if (mode === "currency") delete result.effects[0]!.currency;
    return result;
  });
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fill(user);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
});
test("changing a reviewed date discards old approval", async () => {
  const reads = api(),
    user = userEvent.setup();
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fill(user);
  await screen.findByRole("checkbox", { name: /Gösterilen işlemi/ });
  await user.clear(screen.getByLabelText("Bitiş tarihi"));
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
});
test("uncertain renewal replays the same proof and key after remount with denied catalog", async () => {
  const reads = api(),
    user = userEvent.setup(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/sale_renew_apply_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return bodies.length === 1
          ? HttpResponse.error()
          : HttpResponse.json({
              ok: true,
              data: { operation_id: id, primary_id: other, replayed: true, related: [] },
              trace_id: id,
            });
      },
    ),
  );
  const view = render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fill(user);
  await screen.findByRole("checkbox", { name: /Gösterilen işlemi/ });
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  view.unmount();
  vi.mocked(reads.products).mockRejectedValue(Error("Denied"));
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect({ ...bodies[0], request_id: undefined }).toEqual({ ...bodies[1], request_id: undefined });
  expect(bodies[0]!.request_id).not.toBe(bodies[1]!.request_id);
});
test("renewal metadata must match the exact previous sale and dates", () => {
  expect(renewalMatches(preview(draft), draft)).toBe(true);
  expect(renewalMatches(preview(draft), { ...draft, end_date: "2027-03-01" })).toBe(false);
});
