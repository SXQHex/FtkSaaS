import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EntitlementView, Preview } from "@ftksaas/api-contracts";
import { render } from "./render";
import { SaleRefund } from "../src/components/finance/sale-refund";
import type { RefundApi } from "../src/lib/finance-management";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  sale = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: sale, orgId: person, centerId: sale };
const row: EntitlementView = {
  sale_id: sale,
  person_id: person,
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  state: "active",
  available: 5,
  reserved: 2,
  consumed: 1,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
};
const preview: Preview = {
  id: person,
  token: "synthetic-refund",
  scope_hash: "synthetic",
  expires_at: "2099-01-01T00:00:00Z",
  dependencies: {
    versions: [{ entity: { type: "sales", id: sale }, version: 7 }],
    policy_hashes: [],
    permission_hash: "synthetic",
  },
  effects: [
    {
      action: "adjust",
      entity: { type: "sales", id: sale },
      amount_minor: "120050",
      currency: "TRY",
      reason: "Backend borç iade etkisi",
    },
  ],
  blockers: [],
};
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("sale refund uses backend effects, source rights and a fresh explicit approval", async () => {
  const user = userEvent.setup(),
    read = vi.fn<RefundApi["preview"]>(async () => preview);
  render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="Europe/Istanbul"
      onSaved={vi.fn<() => void>()}
      api={{ sales: async () => [row], access: async () => true, preview: read }}
    />,
  );
  await user.type(await screen.findByLabelText("Gerekçe"), "Satış iade talebi");
  await user.click(screen.getByRole("button", { name: "Satış iadesini incele" }));
  expect(await screen.findByText("Backend borç iade etkisi")).toBeVisible();
  expect(
    screen.getAllByText("Kaynak haklar: kullanılabilir 5, ayrılmış 2, kullanılmış 1."),
  ).toHaveLength(2);
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  expect(read).toHaveBeenCalledWith(scope, sale, "Satış iade talebi");
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.type(screen.getByLabelText("Gerekçe"), " değişti");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
});
test.each(["expired", "blocked", "currency"])("%s refund previews cannot apply", async (mode) => {
  const user = userEvent.setup();
  const value: Preview = {
    ...preview,
    ...(mode === "expired"
      ? { expires_at: "2020-01-01T00:00:00Z" }
      : mode === "blocked"
        ? { blockers: [{ code: "FORBIDDEN", retryable: false, trace_id: person }] }
        : { effects: [{ ...preview.effects[0]!, currency: null }] }),
  };
  render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{ sales: async () => [row], access: async () => true, preview: async () => value }}
    />,
  );
  await user.type(await screen.findByLabelText("Gerekçe"), "Satış iade talebi");
  await user.click(screen.getByRole("button", { name: "Satış iadesini incele" }));
  expect(await screen.findByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
});
test("foreign-person sources and rejected refund permission never expose the refund form", async () => {
  const read = vi.fn<RefundApi["preview"]>();
  const first = render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{
        sales: async () => [{ ...row, person_id: sale }],
        access: async () => true,
        preview: read,
      }}
    />,
  );
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Gerekçe")).not.toBeInTheDocument();
  first.unmount();
  const access = vi.fn<RefundApi["access"]>(async () => false);
  render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{ sales: async () => [row], access, preview: read }}
    />,
  );
  await waitFor(() => expect(access).toHaveBeenCalled());
  expect(screen.queryByLabelText("Gerekçe")).not.toBeInTheDocument();
  expect(read).not.toHaveBeenCalled();
});
test("lost sale-refund response replays only the original token/key from the general pending panel", async () => {
  const { http, HttpResponse } = await import("msw"),
    { server } = await import("./mocks/server");
  const { PendingOperations } = await import("../src/components/setup/pending-operations");
  const user = userEvent.setup(),
    saved = vi.fn<() => void>(),
    writes: Record<string, unknown>[] = [];
  let answer = false;
  server.use(
    http.post("*/functions/v1/backend-v1/sale_refund_apply_v1", async ({ request }) => {
      writes.push((await request.json()) as Record<string, unknown>);
      return answer
        ? HttpResponse.json({
            ok: true,
            data: {
              primary_id: sale,
              operation_id: person,
              version: 8,
              related: [],
              replayed: true,
            },
            trace_id: person,
          })
        : HttpResponse.error();
    }),
  );
  const first = render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="UTC"
      onSaved={saved}
      api={{ sales: async () => [row], access: async () => true, preview: async () => preview }}
    />,
  );
  await user.type(await screen.findByLabelText("Gerekçe"), "Satış iade talebi");
  await user.click(screen.getByRole("button", { name: "Satış iadesini incele" }));
  await user.click(await screen.findByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByText(
    "Sonuç doğrulanamadı. Yeni anahtarla tekrar başlatma; aynı işlemin sonucunu kontrol et.",
  );
  first.unmount();
  answer = true;
  render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(writes.length).toBeGreaterThanOrEqual(2);
  for (const write of writes)
    expect(write).toMatchObject({
      preview: { id: person, token: "synthetic-refund" },
      operation_key: writes[0]!.operation_key,
    });
  expect(writes.at(-1)!.request_id).not.toBe(writes[0]!.request_id);
});
test("changing source keeps denied sales selectable and discards a late preview", async () => {
  const { act } = await import("@testing-library/react");
  const user = userEvent.setup();
  let resolve!: (value: Preview) => void;
  const other = "019a2b3c-4d5e-7000-8000-000000000003";
  render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{
        sales: async () => [row, { ...row, sale_id: other }],
        access: async (_scope, id) => id === sale,
        preview: () =>
          new Promise<Preview>((done) => {
            resolve = done;
          }),
      }}
    />,
  );
  await user.type(await screen.findByLabelText("Gerekçe"), "Satış iade talebi");
  await user.click(screen.getByRole("button", { name: "Satış iadesini incele" }));
  await user.selectOptions(screen.getByLabelText("İade edilecek satış"), other);
  await act(async () => resolve(preview));
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Gerekçe")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("İade edilecek satış"), sale);
  expect(await screen.findByLabelText("Gerekçe")).toHaveValue("");
});

test("a preview for a different source sale cannot be approved", async () => {
  const user = userEvent.setup();
  render(
    <SaleRefund
      scope={scope}
      personId={person}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{
        sales: async () => [row],
        access: async () => true,
        preview: async () => ({
          ...preview,
          dependencies: { ...preview.dependencies, versions: [] },
        }),
      }}
    />,
  );
  await user.type(await screen.findByLabelText("Gerekçe"), "Satış iade talebi");
  await user.click(screen.getByRole("button", { name: "Satış iadesini incele" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Finans önizlemesi doğrulanamadı");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
});
