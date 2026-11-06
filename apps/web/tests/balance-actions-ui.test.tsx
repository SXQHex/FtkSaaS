import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FinanceView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { BalanceActions } from "../src/components/finance/balance-actions";
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
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("each balance action checks its own permission and self cannot see a write form", async () => {
  const access = vi.fn<() => Promise<boolean>>(async () => false);
  render(
    <BalanceActions
      scope={scope}
      view={view}
      timeZone="Europe/Istanbul"
      onSaved={vi.fn<() => void>()}
      api={{ access }}
    />,
  );
  await waitFor(() => expect(access).toHaveBeenCalledTimes(3));
  expect(screen.queryByRole("button", { name: "İşlemi incele" })).not.toBeInTheDocument();
});
test.each(["student_credit_refund_v1", "student_credit_offset_v1", "debt_adjust_v1"] as const)(
  "%s needs explicit review and notifies its owner after successful command",
  async (operation) => {
    const { http, HttpResponse } = await import("msw"),
      { server } = await import("./mocks/server");
    const user = userEvent.setup(),
      saved = vi.fn<() => void>(),
      writes: Record<string, unknown>[] = [];
    server.use(
      http.post(`*/functions/v1/backend-v1/${operation}`, async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: {
            primary_id: debt,
            operation_id: person,
            version: 8,
            related: [],
            replayed: false,
          },
          trace_id: person,
        });
      }),
    );
    render(
      <BalanceActions
        scope={scope}
        view={view}
        timeZone="Europe/Istanbul"
        onSaved={saved}
        api={{ access: async (_scope, candidate) => candidate === operation }}
      />,
    );
    const labels = {
      student_credit_refund_v1: "Alacağı nakit iade et",
      student_credit_offset_v1: "Alacağı borca mahsup et",
      debt_adjust_v1: "Borcu düzelt",
    };
    const section = within(await screen.findByRole("region", { name: labels[operation] }));
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
    expect(writes).toHaveLength(0);
    expect(section.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
    await user.click(section.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
    await user.clear(section.getByLabelText("İşlem tutarı"));
    await user.type(section.getByLabelText("İşlem tutarı"), "1200,50");
    expect(section.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
    await user.click(section.getByRole("button", { name: "İşlemi incele" }));
    expect(section.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
    await user.click(section.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
    await user.click(section.getByRole("button", { name: "İşlemi uygula" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(writes[0]).toMatchObject({ amount_minor: "120050", center_id: debt });
    const source = {
      student_credit_refund_v1: { person_id: person },
      student_credit_offset_v1: { debt_id: debt, person_id: person, expected_version: 7 },
      debt_adjust_v1: { debt_id: debt, direction: "decrease" },
    };
    expect(writes[0]).toMatchObject(source[operation]);
  },
);
test("offset cannot invent an absent debt version", async () => {
  render(
    <BalanceActions
      scope={scope}
      view={{ ...view, debts: [{ ...view.debts[0]!, version: undefined }] }}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{ access: async (_scope, op) => op === "student_credit_offset_v1" }}
    />,
  );
  expect(
    await screen.findByText("Borç sürümü bulunamadı. Finans bilgilerini yeniden okuyun."),
  ).toBeVisible();
  expect(screen.queryByLabelText("İşlem tutarı")).not.toBeInTheDocument();
});
