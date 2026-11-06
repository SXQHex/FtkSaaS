import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FinanceView } from "@ftksaas/api-contracts";
import { render } from "./render";
import type { FinanceApi } from "../src/lib/finance";
import { PersonFinance } from "../src/components/finance/person-finance";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002";
const corrections = {
  canCorrect: async () => false,
  preview: async () => {
    throw Error("denied");
  },
};
const scope = { actorId: id, orgId: other, centerId: id };
const view: FinanceView = {
  person_id: id,
  currency: "TRY",
  credit_available_minor: "9007199254740993",
  debts: [
    {
      id: other,
      remaining_minor: "160000",
      due_at: "2026-11-01T12:00:00Z",
      net_minor: "320000",
      paid_minor: "160000",
    },
  ],
  movements: {
    items: [
      {
        id: other,
        kind: "collection",
        amount_minor: "160000",
        currency: "TRY",
        occurred_at: "2026-11-01T12:00:00Z",
        payment: null,
      },
    ],
    as_of: "2026-11-06T12:00:00Z",
    next_cursor: null,
  },
};
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("finance is lazy, uses an explicit currency and does not turn historical unknown payment into cash", async () => {
  const user = userEvent.setup(),
    read = vi.fn<FinanceApi["read"]>(async () => view),
    api = { read, corrections, canCollect: vi.fn<FinanceApi["canCollect"]>(async () => false) };
  render(<PersonFinance scope={scope} personId={id} timeZone="Europe/Istanbul" api={api} />);
  expect(read).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Finansı aç" }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "try");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  expect(await screen.findByText("₺90.071.992.547.409,93")).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Para hareketleri" })).getByText("Belirtilmemiş"),
  ).toBeVisible();
  expect(screen.queryByRole("button", { name: "Tahsilatı incele" })).not.toBeInTheDocument();
  expect(read).toHaveBeenCalledWith(scope, id, "TRY", undefined);
});
test("a failed refresh removes stale balances and a foreign-person projection is rejected", async () => {
  const user = userEvent.setup(),
    read = vi
      .fn<FinanceApi["read"]>()
      .mockResolvedValueOnce(view)
      .mockRejectedValueOnce(Error("network"))
      .mockResolvedValueOnce({ ...view, person_id: other });
  render(
    <PersonFinance
      scope={scope}
      personId={id}
      timeZone="UTC"
      api={{ read, corrections, canCollect: async () => false }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Finansı aç" }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "TRY");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  await screen.findByText("₺90.071.992.547.409,93");
  await user.click(screen.getByRole("button", { name: "Güncelle" }));
  await waitFor(() => expect(screen.queryByText("₺90.071.992.547.409,93")).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Güncelle" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Finans bilgileri doğrulanamadı");
});
test("a late finance response from the previous account/person cannot reappear", async () => {
  const user = userEvent.setup();
  let resolve!: (value: FinanceView) => void;
  const read = vi.fn<FinanceApi["read"]>(
    () =>
      new Promise<FinanceView>((r) => {
        resolve = r;
      }),
  );
  function ChangingAccount() {
    const [changed, setChanged] = useState(false);
    return (
      <>
        <button onClick={() => setChanged(true)}>Hesabı değiştir</button>
        <PersonFinance
          scope={changed ? { ...scope, actorId: other } : scope}
          personId={changed ? other : id}
          timeZone="UTC"
          api={{ read, corrections, canCollect: async () => false }}
        />
      </>
    );
  }
  render(<ChangingAccount />);
  await user.click(screen.getByRole("button", { name: "Finansı aç" }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "TRY");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  await user.click(screen.getByRole("button", { name: "Hesabı değiştir" }));
  resolve(view);
  await waitFor(() => expect(screen.queryByText("₺90.071.992.547.409,93")).not.toBeInTheDocument());
  expect(screen.queryByLabelText("Para birimi", { exact: true })).not.toBeInTheDocument();
});

test("collection requires explicit method, allocation, local time and review; success rereads the ledger", async () => {
  const { http, HttpResponse } = await import("msw"),
    { server } = await import("./mocks/server");
  const user = userEvent.setup();
  let saved = false;
  const writes: Record<string, unknown>[] = [];
  const api = {
    read: vi.fn<FinanceApi["read"]>(async () => ({
      ...view,
      credit_available_minor: saved ? "50" : "0",
      debts: saved
        ? [{ ...view.debts[0]!, remaining_minor: "0", paid_minor: "320000" }]
        : view.debts,
    })),
    corrections,
    canCollect: async () => true,
  };
  server.use(
    http.post("*/functions/v1/backend-v1/collection_record_v1", async ({ request }) => {
      writes.push((await request.json()) as Record<string, unknown>);
      saved = true;
      return HttpResponse.json({
        ok: true,
        data: { primary_id: other, operation_id: id, version: 1, related: [], replayed: false },
        trace_id: id,
      });
    }),
  );
  render(<PersonFinance scope={scope} personId={id} timeZone="Europe/Istanbul" api={api} />);
  await user.click(screen.getByRole("button", { name: "Finansı aç" }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "TRY");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  await user.type(await screen.findByLabelText("Tahsilat tutarı"), "1600,50");
  await user.selectOptions(screen.getByLabelText("Ödeme yöntemi"), "bank_transfer");
  await user.type(screen.getByLabelText("Ödeme referansı"), "BANKA-TEST");
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(screen.getByLabelText("İşlem zamanı"), {
    target: { value: "2026-11-06T13:00" },
  });
  await user.selectOptions(screen.getByLabelText("Borç tahsisi"), "automatic");
  await user.click(screen.getByRole("button", { name: "Tahsilatı incele" }));
  expect(writes).toHaveLength(0);
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.type(screen.getByLabelText("Ödeme referansı"), "-2");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Tahsilatı incele" }));
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  expect(await screen.findByText("₺0,50")).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    amount_minor: "160050",
    currency: "TRY",
    occurred_at: "2026-11-06T10:00:00.000Z",
    payment: { method: "bank_transfer", reference: "BANKA-TEST-2" },
  });
  expect(api.read).toHaveBeenCalledTimes(2);
});

test("a later currency request wins and a denied collection reader never opens a write form", async () => {
  const user = userEvent.setup();
  let resolve!: (value: FinanceView) => void;
  const api = {
    read: vi.fn<FinanceApi["read"]>((_scope, _person, currency: string) =>
      currency === "TRY"
        ? new Promise<FinanceView>((r) => {
            resolve = r;
          })
        : Promise.resolve({
            ...view,
            currency: "EUR",
            credit_available_minor: "100",
            debts: [],
            movements: { ...view.movements, items: [] },
          }),
    ),
    corrections,
    canCollect: vi.fn<FinanceApi["canCollect"]>(async () => {
      throw Error("POLICY_NOT_CONFIGURED");
    }),
  };
  render(<PersonFinance scope={scope} personId={id} timeZone="UTC" api={api} />);
  await user.click(screen.getByRole("button", { name: "Finansı aç" }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "TRY");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  await user.clear(screen.getByLabelText("Para birimi", { exact: true }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "EUR");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  expect(await screen.findByText("€1,00")).toBeVisible();
  const { act } = await import("@testing-library/react");
  await act(async () => resolve(view));
  expect(screen.queryByText("₺90.071.992.547.409,93")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("Tahsilat yetkisi doğrulanamadı");
  expect(screen.queryByLabelText("Tahsilat tutarı")).not.toBeInTheDocument();
});

test("the general panel recovers a collection with denied discovery and retries only the exact stored payload", async () => {
  const { http, HttpResponse } = await import("msw"),
    { server } = await import("./mocks/server");
  const { collectionCommand } = await import("../src/lib/collection-command"),
    { setupStorageKey } = await import("../src/lib/studio-setup"),
    { PendingOperations } = await import("../src/components/setup/pending-operations");
  const user = userEvent.setup(),
    command = collectionCommand(scope, view, {
      amount: "1600",
      method: "cash",
      reference: "",
      localTime: "2026-11-06T13:00",
      timeZone: "Europe/Istanbul",
      offset: "",
      debtIds: [],
      allocation: "automatic",
      note: "Test",
    });
  const storage = setupStorageKey(scope, `finance:${id}`);
  sessionStorage.setItem(storage, JSON.stringify({ command }));
  sessionStorage.setItem(
    setupStorageKey({ ...scope, actorId: other }, `finance:${id}`),
    JSON.stringify({ command }),
  );
  const writes: Record<string, unknown>[] = [];
  let answer = false;
  server.use(
    http.post("*/functions/v1/backend-v1/collection_record_v1", async ({ request }) => {
      writes.push((await request.json()) as Record<string, unknown>);
      return answer
        ? HttpResponse.json({
            ok: true,
            data: { primary_id: id, operation_id: other, version: 1, related: [], replayed: true },
            trace_id: id,
          })
        : HttpResponse.error();
    }),
  );
  const first = render(<PendingOperations actorId={scope.actorId} onSaved={() => {}} />);
  expect(screen.getAllByRole("button", { name: "Aynı işlemi yeniden gönder" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await screen.findByText(
    "Sonuç doğrulanamadı. Yeni anahtarla tekrar başlatma; aynı işlemin sonucunu kontrol et.",
  );
  first.unmount();
  answer = true;
  render(<PendingOperations actorId={scope.actorId} onSaved={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await screen.findByText("İşlem tamamlandı. Güncel kayıtlar yeniden okunuyor.");
  expect(writes.length).toBeGreaterThanOrEqual(2);
  for (const request of writes) {
    expect(request).toMatchObject(command.input);
  }
  expect(writes.at(-1)!.request_id).not.toBe(writes[0]!.request_id);
  expect(sessionStorage.getItem(storage)).toBeNull();
  expect(
    sessionStorage.getItem(setupStorageKey({ ...scope, actorId: other }, `finance:${id}`)),
  ).not.toBeNull();
});

test("debt selection keeps ledger numbering when earlier debts are already settled", async () => {
  const user = userEvent.setup();
  render(
    <PersonFinance
      scope={scope}
      personId={id}
      timeZone="UTC"
      api={{
        read: async () => ({
          ...view,
          debts: [{ id, remaining_minor: "0", due_at: "2026-10-01T12:00:00Z" }, ...view.debts],
        }),
        corrections,
        canCollect: async () => true,
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Finansı aç" }));
  await user.type(screen.getByLabelText("Para birimi", { exact: true }), "TRY");
  await user.click(screen.getByRole("button", { name: "Finansı oku" }));
  await user.selectOptions(await screen.findByLabelText("Borç tahsisi"), "selected");
  expect(screen.getByRole("checkbox", { name: /^Borç 2 ·/ })).toHaveAttribute("value", other);
  expect(screen.queryByRole("checkbox", { name: /^Borç 1 ·/ })).not.toBeInTheDocument();
});
