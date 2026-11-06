import { expect, test, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Preview } from "@ftksaas/api-contracts";
import { render } from "./render";
import { CollectionCorrection } from "../src/components/finance/collection-correction";
import type { CorrectionApi } from "../src/lib/collection-correction";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  other = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: other, centerId: id };
const movement = {
  id: other,
  kind: "collection" as const,
  amount_minor: "160000",
  currency: "TRY",
  occurred_at: "2026-11-06T10:00:00Z",
};
const preview: Preview = {
  id,
  token: "synthetic",
  scope_hash: "synthetic",
  expires_at: "2099-01-01T00:00:00Z",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
  blockers: [],
  effects: [
    {
      action: "reverse",
      entity: { type: "cash_movements", id: other },
      amount_minor: "12050",
      currency: "TRY",
      reason: "Fazla tahsilat",
    },
  ],
};
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("permission rejection never exposes correction management", async () => {
  const canCorrect = vi.fn<CorrectionApi["canCorrect"]>(async () => false);
  render(
    <CollectionCorrection
      scope={scope}
      movements={[movement]}
      timeZone="Europe/Istanbul"
      onSaved={vi.fn<() => void>()}
      api={{ canCorrect, preview: vi.fn<CorrectionApi["preview"]>() }}
    />,
  );
  await waitFor(() => expect(canCorrect).toHaveBeenCalled());
  expect(screen.queryByLabelText("Düzeltme farkı")).not.toBeInTheDocument();
});
test.each(["denied", "failed"])(
  "a %s collection keeps the source selector available for another permitted collection",
  async (mode) => {
    const user = userEvent.setup();
    render(
      <CollectionCorrection
        scope={scope}
        movements={[movement, { ...movement, id }]}
        timeZone="Europe/Istanbul"
        onSaved={vi.fn<() => void>()}
        api={{
          canCorrect: async (_scope, movementId) => {
            if (movementId === id && mode === "failed") throw Error("network");
            return movementId === other;
          },
          preview: vi.fn<CorrectionApi["preview"]>(),
        }}
      />,
    );
    await screen.findByLabelText("Düzeltme farkı");
    await user.selectOptions(screen.getByRole("combobox", { name: "Kaynak tahsilat" }), id);
    await waitFor(() => expect(screen.queryByLabelText("Düzeltme farkı")).not.toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox", { name: "Kaynak tahsilat" }), other);
    expect(await screen.findByLabelText("Düzeltme farkı")).toBeVisible();
  },
);
test("preview shows directed delta, backend effects and requires a fresh review after edits", async () => {
  const user = userEvent.setup(),
    read = vi.fn<CorrectionApi["preview"]>(async () => preview);
  render(
    <CollectionCorrection
      scope={scope}
      movements={[movement]}
      timeZone="Europe/Istanbul"
      onSaved={vi.fn<() => void>()}
      api={{ canCorrect: async () => true, preview: read }}
    />,
  );
  await user.type(await screen.findByLabelText("Düzeltme farkı"), "120,50");
  await user.selectOptions(screen.getByLabelText("Düzeltme yönü"), "decrease");
  await user.type(screen.getByLabelText("Gerekçe"), "Fazla kayıt");
  const input = screen.getByLabelText("Düzeltme zamanı");
  await user.type(input, "2026-11-06T13:00");
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  expect(await screen.findByText("Fazla tahsilat")).toBeVisible();
  expect(screen.getByText(/Düzeltme zamanı:.*13:00/)).toBeVisible();
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  expect(read.mock.calls[0]?.[0].correction).toMatchObject({
    amount_minor: "12050",
    direction: "decrease",
  });
  await user.type(screen.getByLabelText("Düzeltme farkı"), "0");
  expect(screen.queryByText("Fazla tahsilat")).not.toBeInTheDocument();
});
test.each(["expired", "blocked", "missing-currency"])(
  "unsafe %s previews cannot be applied",
  async (mode) => {
    const user = userEvent.setup();
    const result: Preview = {
      ...preview,
      ...(mode === "expired"
        ? { expires_at: "2020-01-01T00:00:00Z" }
        : mode === "blocked"
          ? { blockers: [{ code: "FORBIDDEN", retryable: false, trace_id: id }] }
          : { effects: [{ ...preview.effects[0]!, currency: null }] }),
    };
    render(
      <CollectionCorrection
        scope={scope}
        movements={[movement]}
        timeZone="UTC"
        onSaved={vi.fn<() => void>()}
        api={{ canCorrect: async () => true, preview: async () => result }}
      />,
    );
    await user.type(await screen.findByLabelText("Düzeltme farkı"), "20");
    await user.selectOptions(screen.getByLabelText("Düzeltme yönü"), "decrease");
    await user.type(screen.getByLabelText("Gerekçe"), "Fazla kayıt");
    await user.type(screen.getByLabelText("Düzeltme zamanı"), "2026-11-06T13:00");
    await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
    expect(await screen.findByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  },
);
test("an edited draft cannot accept a late preview response", async () => {
  const user = userEvent.setup();
  let finish!: (value: Preview) => void;
  const read = vi.fn<CorrectionApi["preview"]>(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <CollectionCorrection
      scope={scope}
      movements={[movement]}
      timeZone="UTC"
      onSaved={vi.fn<() => void>()}
      api={{ canCorrect: async () => true, preview: read }}
    />,
  );
  await user.type(await screen.findByLabelText("Düzeltme farkı"), "20");
  await user.selectOptions(screen.getByLabelText("Düzeltme yönü"), "decrease");
  await user.type(screen.getByLabelText("Gerekçe"), "Fazla kayıt");
  await user.type(screen.getByLabelText("Düzeltme zamanı"), "2026-11-06T13:00");
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  await waitFor(() => expect(read).toHaveBeenCalled());
  await user.type(screen.getByLabelText("Düzeltme farkı"), "0");
  const { act } = await import("@testing-library/react");
  await act(async () => finish(preview));
  expect(screen.queryByText("Fazla tahsilat")).not.toBeInTheDocument();
});
test("a confirmed correction survives a lost response and replays its exact preview/key from the global panel", async () => {
  const { http, HttpResponse } = await import("msw"),
    { server } = await import("./mocks/server");
  const { PendingOperations } = await import("../src/components/setup/pending-operations");
  const { setupStorageKey } = await import("../src/lib/studio-setup");
  const user = userEvent.setup(),
    saved = vi.fn<() => void>(),
    writes: Record<string, unknown>[] = [];
  let answer = false;
  server.use(
    http.post("*/functions/v1/backend-v1/collection_correct_apply_v1", async ({ request }) => {
      writes.push((await request.json()) as Record<string, unknown>);
      return answer
        ? HttpResponse.json({
            ok: true,
            data: { primary_id: other, operation_id: id, version: 2, related: [], replayed: true },
            trace_id: id,
          })
        : HttpResponse.error();
    }),
  );
  const first = render(
    <CollectionCorrection
      scope={scope}
      movements={[movement]}
      timeZone="UTC"
      onSaved={saved}
      api={{ canCorrect: async () => true, preview: async () => preview }}
    />,
  );
  await user.type(await screen.findByLabelText("Düzeltme farkı"), "20");
  await user.selectOptions(screen.getByLabelText("Düzeltme yönü"), "decrease");
  await user.type(screen.getByLabelText("Gerekçe"), "Fazla kayıt");
  await user.type(screen.getByLabelText("Düzeltme zamanı"), "2026-11-06T13:00");
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  await user.click(await screen.findByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByText(
    "Sonuç doğrulanamadı. Yeni anahtarla tekrar başlatma; aynı işlemin sonucunu kontrol et.",
  );
  expect(saved).not.toHaveBeenCalled();
  first.unmount();
  answer = true;
  render(<PendingOperations actorId={id} onSaved={saved} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(writes.length).toBeGreaterThanOrEqual(2);
  for (const write of writes)
    expect(write).toMatchObject({
      preview: { id, token: "synthetic" },
      operation_key: writes[0]!.operation_key,
    });
  expect(writes.at(-1)!.request_id).not.toBe(writes[0]!.request_id);
  expect(sessionStorage.getItem(setupStorageKey(scope, `collection-correct:${other}`))).toBeNull();
});
