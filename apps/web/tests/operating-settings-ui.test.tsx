import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { OperatingSettings } from "../src/components/settings/operating-settings";
import type { OperatingApi } from "../src/lib/operating-settings";
import { discoverPendingOperations } from "../src/lib/pending-operations";
import { setupStorageKey } from "../src/lib/studio-setup";
const mocks = vi.hoisted(() => ({
  send: vi.fn<(command: import("../src/lib/studio-setup").SetupCommand) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: mocks.send,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  scope = { actorId: id, orgId: id };
const source = {
  catalog: {
    scope: "organization" as const,
    catalog_version: 13 as const,
    fields: [
      {
        key: "program_duration_minutes" as const,
        group: "O02",
        consumer: "schedule_build_program" as const,
        writable: true,
      },
    ],
    defaults: { program_duration_minutes: 60 },
    brand_packages: [] as [],
    limitations: [],
  },
  view: {
    scope: "organization" as const,
    version: 7,
    values: { program_duration_minutes: 75 },
    overridden_fields: ["program_duration_minutes" as const],
    as_of: "2026-11-06T10:00:00Z",
  },
};
const api = {
  read: vi.fn<OperatingApi["read"]>(),
  history: vi.fn<OperatingApi["history"]>(),
  reset: vi.fn<OperatingApi["reset"]>(),
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  api.read.mockResolvedValue(source);
  api.history.mockResolvedValue({ items: [], next_cursor: null, as_of: "2026-11-06T10:00:00Z" });
  api.reset.mockResolvedValue({
    id,
    token: "reset-token",
    scope: "organization",
    version: 7,
    before: { program_duration_minutes: 75 },
    after: { program_duration_minutes: 60 },
    fields: ["program_duration_minutes"],
    expires_at: "2099-01-01T00:00:00Z",
  });
  mocks.send.mockResolvedValue({});
});
async function edit() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Program hazırlık süresi (dakika)" }));
  await user.clear(screen.getByLabelText("Yeni değer"));
  await user.type(screen.getByLabelText("Yeni değer"), "90");
  await user.type(screen.getByLabelText("Gerekçe"), "Yeni hazırlık süresi");
  return user;
}
async function confirm(user: ReturnType<typeof userEvent.setup>) {
  const review = screen.getByRole("region", { name: "İşlemi incele" });
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
}
test("organization settings update carries exact version/one-field patch and rereads catalog/values", async () => {
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  expect(mocks.send).not.toHaveBeenCalled();
  await confirm(user);
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "settings_update_v1",
    input: {
      scope: "organization",
      org_id: id,
      expected_version: 7,
      patch: { program_duration_minutes: 90 },
      reason: "Yeni hazırlık süresi",
    },
  });
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("center_id");
  expect(api.history).not.toHaveBeenCalled();
});
test("editing after review removes approval; read-only catalog cannot expose an editable field", async () => {
  api.read.mockResolvedValue({
    ...source,
    catalog: {
      ...source.catalog,
      fields: source.catalog.fields.map((f) => ({ ...f, writable: false })),
    },
  });
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Program hazırlık süresi (dakika)" }));
  expect(screen.queryByLabelText("Yeni değer")).not.toBeInTheDocument();
  expect(screen.getByText("Bu alanı değiştirme yetkisi yok.")).toBeVisible();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("default reset previews the actual before/after and sends only the returned token/version after approval", async () => {
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Varsayılana dönüşü önizle" }));
  const review = await screen.findByRole("region", { name: "İşlemi incele" });
  expect(review).toHaveTextContent("Sonra: 60");
  await confirm(user);
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "settings_reset_apply_v1",
    input: { expected_version: 7, scope: "organization", preview: { id, token: "reset-token" } },
  });
});
test("lost organization write is discoverable without a center and replays the same approved key after remount", async () => {
  mocks.send.mockRejectedValueOnce(new TypeError("lost"));
  const mounted = render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  await confirm(user);
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const original = mocks.send.mock.calls[0][0];
  mounted.unmount();
  expect(discoverPendingOperations(id)).toEqual([
    { scope, slot: "operating-settings:organization", kind: "settings" },
  ]);
  api.read.mockRejectedValue(new Error("FORBIDDEN"));
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
  await waitFor(() =>
    expect(
      sessionStorage.getItem(setupStorageKey(scope, "operating-settings:organization")),
    ).toBeNull(),
  );
});
test("expired or foreign-scope reset cannot be approved", async () => {
  api.reset.mockResolvedValue({
    ...(await api.reset(scope, "organization", "program_duration_minutes")),
    scope: "center",
    expires_at: "2020-01-01T00:00:00Z",
  });
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Varsayılana dönüşü önizle" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});

test("a value edit drops the previous settings approval", async () => {
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  await user.click(
    within(screen.getByRole("region", { name: "İşlemi incele" })).getByRole("checkbox"),
  );
  await user.type(screen.getByLabelText("Yeni değer"), "1");
  expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("expired same-scope reset cannot enter review", async () => {
  api.reset.mockResolvedValue({
    ...(await api.reset(scope, "organization", "program_duration_minutes")),
    expires_at: "2020-01-01T00:00:00Z",
  });
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Varsayılana dönüşü önizle" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});

test("refreshing while reset is in flight drops the late preview", async () => {
  let resolve!: (value: Awaited<ReturnType<OperatingApi["reset"]>>) => void;
  const preview = await api.reset(scope, "organization", "program_duration_minutes");
  api.reset.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  const user = await edit();
  await user.click(screen.getByRole("button", { name: "Varsayılana dönüşü önizle" }));
  await user.click(screen.getByRole("button", { name: "Yeniden oku" }));
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
  resolve(preview);
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: "İşlemi incele" })).not.toBeInTheDocument(),
  );
  expect(mocks.send).not.toHaveBeenCalled();
});
test("history is lazy and uses the native cursor without enabling writes", async () => {
  api.history
    .mockResolvedValueOnce({ items: [], next_cursor: "native-next", as_of: "2026-11-06T10:00:00Z" })
    .mockResolvedValue({ items: [], next_cursor: null, as_of: "2026-11-06T10:00:00Z" });
  render(<OperatingSettings scope={scope} target="organization" api={api} />);
  await screen.findByText("Ayar sürümü: 7");
  expect(api.history).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ayar geçmişi" }));
  await user.click(await screen.findByRole("button", { name: "Sonraki sayfa" }));
  await waitFor(() =>
    expect(api.history).toHaveBeenLastCalledWith(scope, "organization", "native-next"),
  );
  expect(mocks.send).not.toHaveBeenCalled();
});
