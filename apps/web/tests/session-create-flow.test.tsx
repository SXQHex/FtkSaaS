import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { SingleSessionForm } from "../src/components/programs/single-session-form";
import { ClassDuty } from "../src/components/programs/class-duty";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  send: vi.fn<
    (command: { operation: string; input: Record<string, unknown> }) => Promise<unknown>
  >(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  sendSetupCommand: mocks.send,
}));
const scope = {
  actorId: "actor",
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  centerId: "019a2b3c-4d5e-7000-8000-000000000002",
};
const catalog = {
  disciplines: [{ id: "discipline", name: "Tango" }],
  rooms: [{ id: "room", name: "Salon" }],
  instructors: [{ id: "person", name: "Test Eğitmen" }],
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.send.mockResolvedValue({});
});
test("single session sends real catalog IDs and an unambiguous interval with zero categories", async () => {
  render(
    <SingleSessionForm
      scope={scope}
      timeZone="Europe/Istanbul"
      catalog={catalog}
      classes={[]}
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Disiplin"), "discipline");
  await user.selectOptions(screen.getByLabelText("Seans türü"), "group");
  await user.type(screen.getByLabelText("Seans başlangıcı"), "2030-01-07T19:30");
  await user.type(screen.getByLabelText("Seans bitişi"), "2030-01-07T20:30");
  await user.selectOptions(screen.getByLabelText("Oda"), "room");
  await user.selectOptions(screen.getByLabelText("Eğitmen"), "person");
  await user.type(screen.getByLabelText("Kontenjan"), "20");
  await user.click(screen.getByLabelText("Kategori kontenjanı kullan"));
  await user.type(screen.getByLabelText("Erkek kontenjanı"), "0");
  await user.type(screen.getByLabelText("Kadın kontenjanı"), "20");
  await user.click(screen.getByRole("button", { name: "Seansı oluştur" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "session_create_v1",
    input: {
      center_id: scope.centerId,
      interval: { starts_at: "2030-01-07T16:30:00.000Z", ends_at: "2030-01-07T17:30:00.000Z" },
      resources: [{ kind: "room", id: "room" }],
      assignments: [{ person_id: "person", duty: "instructor" }],
      discipline_id: "discipline",
      format: "group",
      capacity: { total: 20, categories: { male: 0, female: 20 } },
    },
  });
});
test("default class duty removal needs impact confirmation and its own version", async () => {
  mocks.call.mockResolvedValue({
    items: [
      {
        operation: "class_assignment_set_v1",
        exists: true,
        entity: { type: "class_assignments", id: "assignment" },
        state: "active",
        versions: [
          { entity: { type: "classes", id: "class" }, version: 99 },
          { entity: { type: "class_assignments", id: "assignment" }, version: 8 },
        ],
        current: {
          operation: "class_assignment_set_v1",
          values: { class_id: "class", person_id: "person", duty: "instructor", state: "active" },
        },
      },
    ],
  });
  render(
    <ClassDuty
      scope={scope}
      classId="class"
      people={[{ id: "person", name: "Test Eğitmen", duty: "instructor" }]}
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Görevlendirilecek kişi"), "person:instructor");
  const remove = await screen.findByRole("button", { name: "Varsayılan görevi kaldır" });
  expect(remove).toBeDisabled();
  await user.click(screen.getByLabelText("Sınıf ve gelecek seans etkilerini onaylıyorum"));
  await user.click(remove);
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "class_assignment_set_v1",
    input: {
      class_id: "class",
      person_id: "person",
      duty: "instructor",
      state: "inactive",
      expected_version: 8,
    },
  });
});

test("session creation recovers the same command when current catalogs are forbidden", async () => {
  const { ProgramRecovery } = await import("../src/components/programs/program-recovery");
  const { setupStorageKey } = await import("../src/lib/studio-setup");
  const pending = {
    command: {
      operation: "session_create_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: "019a2b3c-4d5e-7000-8000-000000000003",
        discipline_id: "discipline",
        format: "group",
        interval: { starts_at: "2030-01-07T16:30:00Z", ends_at: "2030-01-07T17:30:00Z" },
        resources: [{ kind: "room", id: "room" }],
        assignments: [{ person_id: "person", duty: "instructor" }],
        capacity: { total: 0, categories: null },
        inherit_class_assignments: false,
      },
    },
  };
  sessionStorage.setItem(setupStorageKey(scope, "session:new"), JSON.stringify(pending));
  mocks.call.mockRejectedValue(Error("catalog forbidden"));
  render(<ProgramRecovery scope={scope} onSaved={mocks.saved} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toEqual(pending.command);
});
test("single session keeps multiple explicit duties in the scoped recovery command", async () => {
  mocks.send.mockRejectedValue(new TypeError("lost"));
  render(
    <SingleSessionForm
      scope={scope}
      timeZone="Europe/Istanbul"
      catalog={{
        ...catalog,
        duties: [
          { id: "person", name: "Test Eğitmen", duty: "instructor" },
          { id: "second", name: "İkinci eğitmen", duty: "instructor" },
          { id: "helper", name: "Destek", duty: "assistant" },
        ],
      }}
      classes={[]}
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Disiplin"), "discipline");
  await user.selectOptions(screen.getByLabelText("Seans türü"), "group");
  await user.type(screen.getByLabelText("Seans başlangıcı"), "2030-01-07T19:30");
  await user.type(screen.getByLabelText("Seans bitişi"), "2030-01-07T20:30");
  await user.selectOptions(screen.getByLabelText("Oda"), "room");
  await user.selectOptions(screen.getByLabelText("Eğitmen"), "person");
  await user.click(screen.getByLabelText(/İkinci eğitmen/));
  await user.click(screen.getByLabelText(/Destek/));
  await user.type(screen.getByLabelText("Kontenjan"), "20");
  await user.click(screen.getByRole("button", { name: "Seansı oluştur" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const original = mocks.send.mock.calls[0][0];
  expect(original.input).toMatchObject({
    inherit_class_assignments: false,
    assignments: [
      { person_id: "person", duty: "instructor" },
      { person_id: "second", duty: "instructor" },
      { person_id: "helper", duty: "assistant" },
    ],
  });
  mocks.send.mockResolvedValue({});
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
});
