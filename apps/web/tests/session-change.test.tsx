import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { render } from "./render";
import {
  SessionChangeFlow,
  type SessionChangeActions,
} from "../src/components/calendar/session-change";
import { samplePreview, sampleSession } from "../src/components/admin/session-change-fixtures";
import { ApiFailure } from "../src/lib/api";
const actions = {
  preview: vi.fn<SessionChangeActions["preview"]>(),
  apply: vi.fn<SessionChangeActions["apply"]>(),
  status: vi.fn<SessionChangeActions["status"]>(),
};
const props = {
  session: sampleSession,
  orgId: "org",
  actorId: "actor",
  timeZone: "Europe/Istanbul",
  actions,
  onClose: vi.fn<() => void>(),
  onSaved: vi.fn<() => void>(),
};
const storageKey = `ftksaas:session-change:actor:org:${sampleSession.id}`;
const success = {
  operation_id: "operation",
  primary_id: sampleSession.id,
  version: 2,
  replayed: false,
  related: [],
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  actions.preview.mockImplementation(async (input) => samplePreview(input));
  actions.apply.mockResolvedValue(success);
});
afterEach(() => vi.restoreAllMocks());
async function prepare(total = "24") {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Toplam kontenjan"));
  await user.type(screen.getByLabelText("Toplam kontenjan"), total);
  await user.type(screen.getByLabelText("Değişiklik gerekçesi"), "Ders planı güncellendi");
  await user.click(screen.getByRole("button", { name: "Değişikliği önizle" }));
  await screen.findByRole("heading", { name: "Değişecek seanslar (1)" });
  return user;
}
test("capacity-only preview preserves time, resources and assignments and needs explicit confirmation", async () => {
  render(
    <SessionChangeFlow
      {...props}
      session={{
        ...sampleSession,
        starts_at: "2030-10-29T15:00:00.125Z",
        ends_at: "2030-10-29T16:00:00.875Z",
      }}
    />,
  );
  const user = await prepare();
  expect(actions.preview).toHaveBeenCalledWith({
    org_id: "org",
    session_id: sampleSession.id,
    patch: { capacity: { total: 24, categories: null } },
    scope: "single",
    reason: "Ders planı güncellendi",
  });
  expect(actions.apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Değişiklikler kaydedildi");
  expect(sessionStorage.getItem(storageKey)).toBeNull();
  expect(actions.apply.mock.calls[0][0].preview).toEqual({
    id: "019a2b3c-4d5e-7000-8000-000000000013",
    token: "synthetic-preview-token",
  });
});
test("backend blockers prevent applying and edits invalidate the preview", async () => {
  render(<SessionChangeFlow {...props} />);
  const user = await prepare("31");
  expect(screen.getByRole("alert")).toHaveTextContent("fiziksel sınırı");
  expect(screen.getByRole("button", { name: "Değişiklikleri uygula" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Forma dön" }));
  expect(screen.queryByRole("button", { name: "Değişiklikleri uygula" })).not.toBeInTheDocument();
  expect(actions.apply).not.toHaveBeenCalled();
});
test("expired previews are never applied", async () => {
  actions.preview.mockImplementation(async (input) => ({
    ...samplePreview(input),
    expires_at: "2020-01-01T00:00:00Z",
  }));
  render(<SessionChangeFlow {...props} />);
  const user = await prepare();
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Önizlemenin süresi doldu");
  expect(actions.apply).not.toHaveBeenCalled();
});
test("a double click sends one command and saves its recovery record before the request", async () => {
  let finish!: (value: typeof success) => void;
  actions.apply.mockImplementation((input) => {
    expect(JSON.parse(sessionStorage.getItem(storageKey)!)).toEqual({
      operation_key: input.operation_key,
      preview: input.preview,
    });
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  render(<SessionChangeFlow {...props} />);
  const user = await prepare();
  await user.dblClick(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  expect(actions.apply).toHaveBeenCalledTimes(1);
  await act(async () => finish(success));
});
test("lost responses survive remount and replay exactly the same command", async () => {
  actions.apply.mockRejectedValueOnce(new Error("network"));
  const view = render(<SessionChangeFlow {...props} />);
  const user = await prepare();
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  await screen.findByText("İşlem sonucu henüz doğrulanamadı");
  const sent = actions.apply.mock.calls[0][0];
  view.unmount();
  render(<SessionChangeFlow {...props} />);
  expect(screen.queryByLabelText("Toplam kontenjan")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Değişiklikler kaydedildi");
  expect(actions.apply.mock.calls[1][0]).toEqual(sent);
  expect(actions.preview).toHaveBeenCalledTimes(1);
});
test("permission loss during recovery does not erase an operation that may have committed", async () => {
  actions.apply.mockRejectedValueOnce(new Error("network")).mockRejectedValueOnce(
    new ApiFailure({
      ok: false,
      error: { code: "FORBIDDEN", retryable: false, trace_id: "synthetic" },
    }),
  );
  render(<SessionChangeFlow {...props} />);
  const user = await prepare();
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("yetkin yok");
  expect(sessionStorage.getItem(storageKey)).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Değişikliği önizle" })).not.toBeInTheDocument();
});
test("status confirmation completes a pending operation without applying again", async () => {
  actions.apply.mockRejectedValueOnce(new Error("network"));
  actions.status.mockImplementation(async (_org, key) => ({
    operation: "session_change_apply_v1",
    key,
    status: "succeeded",
    result_available: true,
    result_reference: { type: "sessions", id: sampleSession.id },
  }));
  render(<SessionChangeFlow {...props} />);
  const user = await prepare();
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  await user.click(await screen.findByRole("button", { name: "Sonucu kontrol et" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Değişiklikler kaydedildi");
  expect(actions.apply).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(storageKey)).toBeNull();
});
test("storage failure stops a command before any write is sent", async () => {
  render(<SessionChangeFlow {...props} />);
  const user = await prepare();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  await user.click(screen.getByRole("button", { name: "Değişiklikleri uygula" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Yeni değişiklik gönderilmedi");
  expect(actions.apply).not.toHaveBeenCalled();
});
test("another account cannot pick up the previous account's pending command", async () => {
  sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      operation_key: "019a2b3c-4d5e-7000-8000-000000000016",
      preview: { id: "019a2b3c-4d5e-7000-8000-000000000013", token: "synthetic" },
    }),
  );
  render(<SessionChangeFlow {...props} actorId="another-account" />);
  expect(screen.getByLabelText("Toplam kontenjan")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
  expect(actions.apply).not.toHaveBeenCalled();
});
