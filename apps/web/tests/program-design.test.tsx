import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { beforeEach, expect, test, vi } from "vitest";
import { render as renderComponent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { setupStorageKey } from "../src/lib/studio-setup";
import { ApiFailure } from "../src/lib/api";
import { ProgramManager } from "../src/components/programs/program-manager";
const mocks = vi.hoisted(() => ({
  classes: vi.fn<typeof import("../src/lib/program").getClasses>(),
  catalog: vi.fn<typeof import("../src/lib/program").getProgramCatalog>(),
}));
vi.mock("../src/lib/program", async (load) => ({
  ...(await load<typeof import("../src/lib/program")>()),
  getClasses: mocks.classes,
  getProgramCatalog: mocks.catalog,
}));
vi.mock("../src/components/programs/program-history", () => ({ ProgramHistory: () => null }));
const scope = { actorId: "actor", orgId: "org", centerId: "center" };
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.catalog.mockResolvedValue({
    rooms: [{ id: "room", name: "Salon" }],
    disciplines: [{ id: "discipline", name: "Tango" }],
    instructors: [{ id: "teacher", name: "Eğitmen" }],
    duties: [],
  });
  mocks.classes.mockResolvedValue([
    {
      operation: "class_save_v1",
      exists: true,
      state: "active",
      entity: { type: "classes", id: "class" },
      versions: [{ entity: { type: "classes", id: "class" }, version: 1 }],
      as_of: "2030-01-01T00:00:00Z",
      current: {
        operation: "class_save_v1",
        values: { name: "Tango Başlangıç", discipline_id: "discipline", external_open: false },
      },
    },
  ]);
});
test("management starts with class cards and opens a focused class form by keyboard", async () => {
  render(<ProgramManager scope={scope} timeZone="Europe/Istanbul" onChanged={() => {}} />);
  await screen.findByRole("heading", { name: "Tango Başlangıç" });
  expect(screen.queryByLabelText("Sınıf adı")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Seans başlangıcı")).not.toBeInTheDocument();
  const user = userEvent.setup();
  const create = screen.getByRole("button", { name: "Sınıf oluştur" });
  create.focus();
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("dialog", { name: "Sınıf oluştur" })).toBeVisible();
  expect(screen.getByLabelText("Sınıf adı")).toBeVisible();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(create).toHaveFocus());
  expect(screen.queryByLabelText("Sınıf adı")).not.toBeInTheDocument();
});
test("class actions open only their intended form with the chosen class context", async () => {
  render(<ProgramManager scope={scope} timeZone="Europe/Istanbul" onChanged={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sınıfı yönet: Tango Başlangıç" }));
  expect(screen.getByRole("heading", { name: "Sınıf ayrıntısı" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Programı planla" }));
  expect(await screen.findByRole("dialog", { name: "Program oluştur" })).toBeVisible();
  expect(screen.getByLabelText("Başlangıç tarihi")).toBeVisible();
  expect(screen.queryByLabelText("Sınıf adı")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Görevlendirilecek kişi")).not.toBeInTheDocument();
});

test("changing scope dismisses an open editor before the next catalog arrives", async () => {
  const view = (centerId: string) => (
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      <ProgramManager
        scope={{ ...scope, centerId }}
        timeZone="Europe/Istanbul"
        onChanged={() => {}}
      />
    </NextIntlClientProvider>
  );
  const { rerender } = renderComponent(view(scope.centerId));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sınıf oluştur" }));
  expect(await screen.findByRole("dialog", { name: "Sınıf oluştur" })).toBeVisible();
  mocks.classes.mockImplementationOnce(() => new Promise(() => {}));
  rerender(view("other"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Sınıf adı")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Yükleniyor");
});

function pendingProgram() {
  const key = setupStorageKey(scope, "program:class");
  const saved = JSON.stringify({
    command: {
      operation: "program_apply_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: "019a2b3c-4d5e-7000-8000-000000000004",
        preview: { id: "019a2b3c-4d5e-7000-8000-000000000005", token: "synthetic" },
      },
    },
  });
  sessionStorage.setItem(key, saved);
  return { key, saved };
}

test("closing and reopening the program editor preserves the pending command and one recovery surface", async () => {
  const pending = pendingProgram();
  render(<ProgramManager scope={scope} timeZone="Europe/Istanbul" onChanged={() => {}} />);
  await screen.findByRole("region", { name: "Bekleyen takvim işlemleri" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Sınıfı yönet: Tango Başlangıç" }));
  const plan = screen.getByRole("button", { name: "Programı planla" });
  for (let attempt = 0; attempt < 2; attempt++) {
    await user.click(plan);
    expect(await screen.findByRole("dialog", { name: "Program oluştur" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Programı önizle" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Aynı işlemi yeniden gönder" })).toHaveLength(1);
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("region", { name: "Bekleyen takvim işlemleri" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "İşlem sonucunu kontrol et" })).toHaveLength(1);
    expect(sessionStorage.getItem(pending.key)).toBe(pending.saved);
    await waitFor(() => expect(plan).toHaveFocus());
  }
});

test("catalog access loss keeps pending program recovery available without a write form", async () => {
  const pending = pendingProgram();
  mocks.catalog.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "FORBIDDEN", retryable: false, trace_id: "synthetic" },
    }),
  );
  render(<ProgramManager scope={scope} timeZone="Europe/Istanbul" onChanged={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bu işlem için gerekli yetkin yok.");
  expect(screen.getByRole("region", { name: "Bekleyen takvim işlemleri" })).toBeVisible();
  expect(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Sınıf oluştur" })).not.toBeInTheDocument();
  expect(sessionStorage.getItem(pending.key)).toBe(pending.saved);
});
