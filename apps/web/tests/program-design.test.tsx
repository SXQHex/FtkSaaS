import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { beforeEach, expect, test, vi } from "vitest";
import { render as renderComponent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
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
