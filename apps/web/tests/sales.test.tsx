import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Preview, SalePreview, ProductView, EntitlementView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { ApiFailure } from "../src/lib/api";
import { PersonSales } from "../src/components/products/person-sales";
import {
  salesApi,
  saleMatches,
  renewalMatches,
  type SalesApi,
  type RenewalInput,
} from "../src/lib/sales";
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
  await user.click(screen.getByRole("button", { name: "Paket yenileme" }));
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

function normalPreview(kind: "credits" | "timed" = "credits"): SalePreview {
  const base = preview(draft);
  delete base.sale_lifecycle;
  return {
    ...base,
    effects: [],
    sale: {
      person_id: other,
      product_version_id: other,
      kind,
      booking_mode: "flexible",
      start_date: draft.start_date,
      end_date: draft.end_date,
      timezone: "Europe/Istanbul",
      valid_from: "2026-12-31T21:00:00Z",
      valid_until: "2027-01-31T21:00:00Z",
      debt_minor: "12345",
      currency: "TRY",
      granted: kind === "credits" ? 8 : 0,
      reserved: 0,
      consumed: 0,
      available: kind === "credits" ? 8 : 0,
      quota: null,
      deficits: [],
    },
  };
}
async function fillSale(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Satış ve yenilemeyi aç" }));
  await user.click(screen.getByRole("button", { name: "Yeni satış" }));
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Yeni ürün sürümü" }),
    other,
  );
  await user.type(screen.getByLabelText("Başlangıç tarihi"), draft.start_date);
  await user.type(screen.getByLabelText("Bitiş tarihi"), draft.end_date);
  await user.click(screen.getByRole("button", { name: "Satışı incele" }));
}
test.each(["credits", "quota", "unlimited"])(
  "%s normal sale shows authoritative debt and rights before apply",
  async (kind) => {
    const reads = api(),
      user = userEvent.setup(),
      result = normalPreview(kind === "credits" ? "credits" : "timed");
    if (kind === "quota") result.sale.quota = { period: "month", limit: 4 };
    vi.mocked(reads.products).mockResolvedValue({
      items: [
        {
          ...product,
          terms: { ...product.terms, kind: result.sale.kind, quota: result.sale.quota },
        },
      ],
      next_cursor: null,
      as_of: "2026-11-05T00:00:00Z",
    });
    reads.salePreview = vi.fn<SalesApi["salePreview"]>().mockResolvedValue(result);
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(
        "https://project.example.invalid/functions/v1/backend-v1/sale_apply_v1",
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
    render(<PersonSales scope={scope} personId={other} api={reads} />);
    await fillSale(user);
    await screen.findByText("Oluşacak borç");
    expect(bodies).toHaveLength(0);
    expect(screen.getByText("Tahsilat bu işlemle yapılmaz.")).toBeInTheDocument();
    expect(screen.queryAllByText("Verilecek kredi")).toHaveLength(kind === "credits" ? 1 : 0);
    expect(reads.salePreview).toHaveBeenCalledWith(scope, {
      person_id: other,
      product_version_id: other,
      start_date: draft.start_date,
      end_date: draft.end_date,
    });
    await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
    await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(() => expect(reads.finance).toHaveBeenCalledWith(scope, other, "TRY"));
    expect(bodies[0]).toMatchObject({ preview: { id, token: "synthetic-preview" } });
  },
);
test("normal sale binds person, version, dates and expiry without requiring a fake create effect", () => {
  const input = {
    person_id: other,
    product_version_id: other,
    start_date: draft.start_date,
    end_date: draft.end_date,
  };
  expect(saleMatches(normalPreview(), input)).toBe(true);
  expect(saleMatches(normalPreview(), { ...input, person_id: id })).toBe(false);
  expect(saleMatches(normalPreview(), { ...input, product_version_id: id })).toBe(false);
  expect(saleMatches(normalPreview(), { ...input, end_date: "2027-03-01" })).toBe(false);
  expect(saleMatches({ ...normalPreview(), expires_at: "2020-01-01T00:00:00Z" }, input)).toBe(
    false,
  );
});

function normalApi() {
  const reads = api();
  reads.salePreview = vi.fn<SalesApi["salePreview"]>().mockResolvedValue(normalPreview());
  reads.session = vi.fn<SalesApi["session"]>().mockResolvedValue({
    id,
    discipline_id: id,
    class_id: null,
    format: "group",
    capacity: {
      total: 8,
      held: 0,
      remaining: 8,
      room_capacity: 8,
      category_held: null,
      category_remaining: null,
    },
    starts_at: "2026-12-15T10:00:00Z",
    ends_at: "2026-12-15T11:00:00Z",
    state: "planned",
    attendance_state: "open",
    assignments: [],
    version: 1,
  });
  return reads;
}
test("sale deficits show authoritative settled and unchanged decisions, exact session and debt", async () => {
  const reads = normalApi(),
    result = normalPreview(),
    user = userEvent.setup();
  result.sale.debt_minor = "900719925474099301";
  result.sale.deficits = [
    {
      deficit_id: id,
      reservation_id: id,
      session_id: id,
      version: 1,
      reservation_version: 2,
      session_version: 1,
      state: "consumed",
      quantity: 2,
      settles: true,
    },
    {
      deficit_id: other,
      reservation_id: other,
      session_id: id,
      version: 2,
      reservation_version: 3,
      session_version: 1,
      state: "reserved",
      quantity: 9,
      settles: false,
    },
  ];
  vi.mocked(reads.salePreview).mockResolvedValue(result);
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fillSale(user);
  await screen.findByText(/Bu satışla karşılanacak/);
  expect(screen.getByText(/Eksik hak bu satışla karşılanmayacak/)).toBeInTheDocument();
  expect(screen.getByText(/9.007.199.254.740.993,01/)).toBeInTheDocument();
  expect(reads.session).toHaveBeenCalledExactlyOnceWith(scope.orgId, scope.centerId, id);
});
test.each(["changed-person", "changed-session", "denied-session"])(
  "%s cannot approve a sale snapshot",
  async (mode) => {
    const reads = normalApi(),
      result = normalPreview(),
      user = userEvent.setup();
    if (mode === "changed-person") result.sale.person_id = id;
    else
      result.sale.deficits = [
        {
          deficit_id: id,
          reservation_id: id,
          session_id: id,
          version: 1,
          reservation_version: 1,
          session_version: 2,
          state: "consumed",
          quantity: 1,
          settles: true,
        },
      ];
    if (mode === "denied-session") vi.mocked(reads.session).mockRejectedValue(Error("Denied"));
    vi.mocked(reads.salePreview).mockResolvedValue(result);
    render(<PersonSales scope={scope} personId={other} api={reads} />);
    await fillSale(user);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  },
);
test("document blocker disables apply and opening documents discards the old preview", async () => {
  const reads = normalApi(),
    result = normalPreview(),
    user = userEvent.setup();
  result.blockers = [{ code: "DOCUMENT_REQUIRED", retryable: false, trace_id: id }];
  vi.mocked(reads.salePreview).mockResolvedValue(result);
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fillSale(user);
  expect(await screen.findByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Gerekli belgeler" }));
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Öğrenci için belge kabul bağlantısı" })).toHaveAttribute(
    "href",
    `/organizasyon/${scope.orgId}/paket/${product.version_id}/belgeler?center=${scope.centerId}`,
  );
});
test("uncertain normal sale recovers same proof and key after remount despite denied reads", async () => {
  const reads = normalApi(),
    user = userEvent.setup(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/sale_apply_v1",
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
  await fillSale(user);
  await screen.findByText("Oluşacak borç");
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
  await screen.findByText("Satın alınmış haklar yeniden okundu.");
});
test("stale sale rejection removes review and requires an explicit new preview", async () => {
  const reads = normalApi(),
    user = userEvent.setup();
  server.use(
    http.post("https://project.example.invalid/functions/v1/backend-v1/sale_apply_v1", () =>
      HttpResponse.json({
        ok: false,
        error: { code: "PREVIEW_STALE", retryable: false, trace_id: id },
      }),
    ),
  );
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fillSale(user);
  await screen.findByText("Oluşacak borç");
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  expect(reads.salePreview).toHaveBeenCalledTimes(1);
});

test("sale.write actor can review a new sale without access to historical rights", async () => {
  const reads = normalApi(),
    user = userEvent.setup();
  vi.mocked(reads.rights).mockRejectedValue(Error("Denied"));
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fillSale(user);
  await screen.findByText("Oluşacak borç");
  expect(reads.rights).not.toHaveBeenCalled();
});

test("sale.write preview remains usable when only linked session detail is forbidden", async () => {
  const reads = normalApi(),
    result = normalPreview(),
    user = userEvent.setup();
  result.sale.deficits = [
    {
      deficit_id: id,
      reservation_id: id,
      session_id: id,
      version: 1,
      reservation_version: 1,
      session_version: 1,
      state: "consumed",
      quantity: 1,
      settles: true,
    },
  ];
  vi.mocked(reads.salePreview).mockResolvedValue(result);
  vi.mocked(reads.session).mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: id } }),
  );
  render(<PersonSales scope={scope} personId={other} api={reads} />);
  await fillSale(user);
  await screen.findByText("Seans ayrıntısı bu yetkiyle okunamıyor.");
  expect(screen.getByText(/Bu satışla karşılanacak/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeEnabled();
});
