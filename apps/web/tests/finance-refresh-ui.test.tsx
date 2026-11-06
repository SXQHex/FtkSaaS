import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { EntitlementView, FinanceView, Preview } from "@ftksaas/api-contracts";
import { server } from "./mocks/server";
import { render } from "./render";
import { PersonFinance } from "../src/components/finance/person-finance";
import { balanceCommand, financeActionSlot } from "../src/lib/finance-actions";
import { setupStorageKey } from "../src/lib/studio-setup";
import { PendingOperations } from "../src/components/setup/pending-operations";
import type { FinanceApi } from "../src/lib/finance";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  debt = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: debt, orgId: person, centerId: debt };
const view: FinanceView = {
  person_id: person,
  currency: "TRY",
  credit_available_minor: "160000",
  debts: [
    {
      id: debt,
      center_id: debt,
      version: 7,
      due_at: "2026-11-01T10:00:00Z",
      remaining_minor: "200000",
    },
  ],
  movements: { items: [], as_of: "2026-11-06T10:00:00Z" },
};
const row: EntitlementView = {
  sale_id: debt,
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
    versions: [{ entity: { type: "sales", id: debt }, version: 7 }],
    policy_hashes: [],
    permission_hash: "synthetic",
  },
  effects: [
    {
      action: "adjust",
      entity: { type: "sales", id: debt },
      amount_minor: "120050",
      currency: "TRY",
    },
  ],
  blockers: [],
};
const labels = {
  student_credit_refund_v1: "Alacağı nakit iade et",
  student_credit_offset_v1: "Alacağı borca mahsup et",
  debt_adjust_v1: "Borcu düzelt",
  sale_refund_apply_v1: "Satış iadesi",
};
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test.each([
  "student_credit_refund_v1",
  "student_credit_offset_v1",
  "debt_adjust_v1",
  "sale_refund_apply_v1",
] as const)(
  "%s rereads authoritative balances and sale rights after applying",
  async (operation) => {
    const user = userEvent.setup();
    let saved = false;
    const api: FinanceApi = {
      read: vi.fn<FinanceApi["read"]>(async () =>
        saved
          ? {
              ...view,
              credit_available_minor: operation.startsWith("student_credit_") ? "39950" : "160000",
              debts: [
                {
                  ...view.debts[0]!,
                  version: 8,
                  remaining_minor: operation === "student_credit_refund_v1" ? "200000" : "79950",
                },
              ],
            }
          : view,
      ),
      canCollect: async () => false,
      corrections: {
        canCorrect: async () => false,
        preview: async () => {
          throw Error("denied");
        },
      },
      balance: { access: async (_scope, candidate) => candidate === operation },
      refunds: {
        sales: vi.fn<FinanceApi["refunds"]["sales"]>(async () => [row]),
        access: async () => operation === "sale_refund_apply_v1",
        preview: async () => preview,
      },
    };
    server.use(
      http.post(`*/functions/v1/backend-v1/${operation}`, () => {
        saved = true;
        return HttpResponse.json({
          ok: true,
          trace_id: person,
          data: {
            primary_id: debt,
            operation_id: person,
            version: 8,
            related: [],
            replayed: false,
          },
        });
      }),
    );
    render(
      <PersonFinance
        management
        scope={scope}
        personId={person}
        timeZone="Europe/Istanbul"
        api={api}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Finansı aç" }));
    await user.type(screen.getByLabelText("Para birimi", { exact: true }), "TRY");
    await user.click(screen.getByRole("button", { name: "Finansı oku" }));
    const section = within(await screen.findByRole("region", { name: labels[operation] }));
    if (operation === "sale_refund_apply_v1") {
      await user.type(await section.findByLabelText("Gerekçe"), "Satış iade talebi");
      await user.click(section.getByRole("button", { name: "Satış iadesini incele" }));
    } else {
      await user.type(await section.findByLabelText("İşlem tutarı"), "1200,50");
      if (operation !== "student_credit_offset_v1")
        await user.type(section.getByLabelText("Gerekçe"), "Müşteri talebi");
      if (operation === "debt_adjust_v1")
        await user.selectOptions(section.getByLabelText("Borç düzeltme yönü"), "decrease");
      if (operation === "student_credit_refund_v1")
        fireEvent.change(section.getByLabelText("İade zamanı"), {
          target: { value: "2026-11-06T13:00" },
        });
      await user.click(section.getByRole("button", { name: "İşlemi incele" }));
    }
    await user.click(await section.findByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
    await user.click(section.getByRole("button", { name: "İşlemi uygula" }));
    await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.refunds.sales).toHaveBeenCalledTimes(2));
    expect(api.read).toHaveBeenLastCalledWith(scope, person, "TRY", undefined);
    expect(
      await screen.findByText(operation.startsWith("student_credit_") ? "₺399,50" : "₺1.600,00"),
    ).toBeVisible();
    expect(
      screen.getAllByText(operation === "student_credit_refund_v1" ? "₺2.000,00" : "₺799,50")
        .length,
    ).toBeGreaterThan(0);
  },
);
test.each(["student_credit_refund_v1", "student_credit_offset_v1", "debt_adjust_v1"] as const)(
  "%s recovers an uncertain outcome with exactly the original payload and key",
  async (operation) => {
    const command = balanceCommand(operation, scope, view, {
      amount: "1200,50",
      debtId: debt,
      direction: "decrease",
      reason: "Müşteri talebi",
      localTime: "2026-11-06T13:00",
      timeZone: "Europe/Istanbul",
      offset: "",
    });
    const storage = setupStorageKey(scope, financeActionSlot(operation, person, debt));
    sessionStorage.setItem(storage, JSON.stringify({ command }));
    const writes: Record<string, unknown>[] = [],
      user = userEvent.setup(),
      saved = vi.fn<() => void>();
    let answer = false;
    server.use(
      http.post(`*/functions/v1/backend-v1/${operation}`, async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return answer
          ? HttpResponse.json({
              ok: true,
              trace_id: person,
              data: {
                primary_id: debt,
                operation_id: person,
                version: 8,
                related: [],
                replayed: true,
              },
            })
          : HttpResponse.error();
      }),
    );
    const first = render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
    await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
    await screen.findByText(
      "Sonuç doğrulanamadı. Yeni anahtarla tekrar başlatma; aynı işlemin sonucunu kontrol et.",
    );
    first.unmount();
    answer = true;
    render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
    await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    for (const write of writes) expect(write).toMatchObject(command.input);
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes.at(-1)!.request_id).not.toBe(writes[0]!.request_id);
    expect(sessionStorage.getItem(storage)).toBeNull();
  },
);
