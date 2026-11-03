import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { ClassForm } from "../src/components/programs/class-form";
import { ProgramForm } from "../src/components/programs/program-form";
import { setupStorageKey } from "../src/lib/studio-setup";
import { ApiFailure } from "../src/lib/api";
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
const selected = {
  id: "class",
  version: 9,
  name: "Tango",
  discipline_id: "discipline",
  external_open: false,
};
const catalog = {
  disciplines: [{ id: "discipline", name: "Tango" }],
  rooms: [{ id: "room", name: "Salon" }],
  instructors: [{ id: "teacher", name: "Test Eğitmen" }],
};
const preview = {
  id: "019a2b3c-4d5e-7000-8000-000000000003",
  token: "test-preview",
  dependencies: { entries: [] },
  scope_hash: "scope",
  effects: [],
  blockers: [],
  sessions: [],
  expires_at: "2099-01-01T00:00:00Z",
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.send.mockResolvedValue({});
  mocks.call.mockResolvedValue(preview);
});
test("class editing uses the class version and preserves a closed group", async () => {
  const user = userEvent.setup();
  render(
    <ClassForm
      scope={scope}
      current={selected}
      disciplines={catalog.disciplines}
      onSaved={mocks.saved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Sınıfı kaydet" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "class_save_v1",
    input: {
      class_id: "class",
      expected_version: 9,
      external_open: false,
      discipline_id: "discipline",
      center_id: scope.centerId,
    },
  });
});
async function fillProgram() {
  const user = userEvent.setup();
  for (const [label, value] of [
    ["Başlangıç tarihi", "2030-01-01"],
    ["Bitiş tarihi (hariç)", "2030-02-01"],
    ["Başlangıç saati", "19:30"],
    ["Süre (dakika)", "60"],
    ["Kontenjan", "20"],
  ])
    await user.type(screen.getByLabelText(label), value);
  await user.selectOptions(screen.getByLabelText("Oda"), "room");
  await user.selectOptions(screen.getByLabelText("Eğitmen"), "teacher");
  await user.click(screen.getByLabelText("Pazartesi"));
  await user.click(screen.getByRole("button", { name: "Programı önizle" }));
  return user;
}
test("program never applies before confirmation and uses the returned preview token", async () => {
  render(
    <ProgramForm
      scope={scope}
      selected={selected}
      catalog={catalog}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = await fillProgram();
  await screen.findByRole("button", { name: "Onayla ve oluştur" });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.call.mock.calls[0][1]).toMatchObject({
    class_id: "class",
    schedule: {
      weekdays: [1],
      starts_on: "2030-01-01",
      ends_on: "2030-02-01",
      local_start: "19:30:00",
      assignments: [{ person_id: "teacher", duty: "instructor" }],
    },
  });
  await user.click(screen.getByRole("checkbox", { name: "Gösterilen etkileri onaylıyorum" }));
  await user.click(screen.getByRole("button", { name: "Onayla ve oluştur" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "program_apply_v1",
    input: { preview: { id: preview.id, token: preview.token } },
  });
});
test("backend blockers and expired previews cannot be applied", async () => {
  mocks.call.mockResolvedValue({
    ...preview,
    blockers: [{ code: "RESOURCE_CONFLICT", retryable: false, trace_id: "test" }],
  });
  render(
    <ProgramForm
      scope={scope}
      selected={selected}
      catalog={catalog}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  await fillProgram();
  expect(await screen.findByRole("button", { name: "Onayla ve oluştur" })).toBeDisabled();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("typed agreement diagnosis uses returned references and requires a fresh confirmed program preview", async () => {
  mocks.call.mockResolvedValueOnce({
    ...preview,
    blockers: [{ code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: "synthetic" }],
    configuration_requirement: {
      blocker_index: 0,
      kind: "instructor_agreement",
      person_id: "teacher",
      discipline_id: "discipline",
      format: "group",
      starts_at: "2030-01-07T16:30:00Z",
    },
  });
  render(
    <ProgramForm
      scope={scope}
      selected={selected}
      catalog={catalog}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = await fillProgram();
  expect(
    await screen.findByRole("region", { name: "Eğitmen anlaşması doğrulanamadı" }),
  ).toHaveTextContent("Test Eğitmen");
  expect(screen.getByRole("button", { name: "Onayla ve oluştur" })).toBeDisabled();
  expect(mocks.send).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Forma dön" }));
  await user.click(screen.getByRole("button", { name: "Programı önizle" }));
  expect(await screen.findByRole("button", { name: "Onayla ve oluştur" })).toBeDisabled();
  expect(
    screen.queryByRole("region", { name: "Eğitmen anlaşması doğrulanamadı" }),
  ).not.toBeInTheDocument();
  expect(mocks.call).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("checkbox", { name: "Gösterilen etkileri onaylıyorum" }));
  await user.click(screen.getByRole("button", { name: "Onayla ve oluştur" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    input: { preview: { id: preview.id, token: preview.token } },
  });
});
test("uncertain program apply recovers the same payload and key after remount", async () => {
  const pending = {
    command: {
      operation: "program_apply_v1",
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: "019a2b3c-4d5e-7000-8000-000000000004",
        preview: { id: preview.id, token: preview.token },
      },
    },
  };
  sessionStorage.setItem(setupStorageKey(scope, "program:class"), JSON.stringify(pending));
  mocks.send.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "PREVIEW_STALE", retryable: false, trace_id: "test" },
    }),
  );
  render(
    <ProgramForm
      scope={scope}
      selected={selected}
      catalog={catalog}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(mocks.send.mock.calls[0][0]).toEqual(pending.command);
  expect(sessionStorage.getItem(setupStorageKey(scope, "program:class"))).not.toBeNull();
  expect(mocks.saved).not.toHaveBeenCalled();
});

test("expired program preview is blocked even after a valid preview response", async () => {
  mocks.call.mockResolvedValue({ ...preview, expires_at: "2000-01-01T00:00:00Z" });
  render(
    <ProgramForm
      scope={scope}
      selected={selected}
      catalog={catalog}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  await fillProgram();
  expect(await screen.findByRole("button", { name: "Onayla ve oluştur" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("süresi doldu");
  expect(mocks.send).not.toHaveBeenCalled();
});
test("class mutation is not sent when the recovery journal cannot be written", async () => {
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("storage unavailable");
  });
  render(
    <ClassForm
      scope={scope}
      current={selected}
      disciplines={catalog.disciplines}
      onSaved={mocks.saved}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Sınıfı kaydet" }));
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.saved).not.toHaveBeenCalled();
  spy.mockRestore();
});

test("returning to the form allows a fresh preview", async () => {
  render(
    <ProgramForm
      scope={scope}
      selected={selected}
      catalog={catalog}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = await fillProgram();
  await user.click(await screen.findByRole("button", { name: "Forma dön" }));
  await user.click(screen.getByRole("button", { name: "Programı önizle" }));
  await waitFor(() => expect(mocks.call).toHaveBeenCalledTimes(2));
});
