import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { ReplacementSession } from "../src/components/calendar/replacement-session";
import { sampleSession } from "../src/components/admin/session-change-fixtures";
const mocks = vi.hoisted(() => ({
  catalog: vi.fn<typeof import("../src/lib/program").getProgramCatalog>(),
  send: vi.fn<typeof import("../src/lib/studio-setup").sendSetupCommand>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/program", async (load) => ({
  ...(await load<typeof import("../src/lib/program")>()),
  getProgramCatalog: mocks.catalog,
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: mocks.send,
}));
const scope = {
  actorId: "actor",
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  centerId: "019a2b3c-4d5e-7000-8000-000000000002",
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.catalog.mockResolvedValue({
    rooms: [{ id: "room", name: "Salon" }],
    disciplines: [],
    instructors: [],
    duties: [],
  });
  mocks.send.mockResolvedValue({
    operation_id: "op",
    primary_id: "replacement",
    version: 1,
    replayed: false,
    related: [],
  });
});
test("replacement uses an immutable cancelled source, explicit interval and resources", async () => {
  render(
    <ReplacementSession
      scope={scope}
      source={{ ...sampleSession, state: "cancelled" }}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText("Oda"), "room");
  await user.type(screen.getByLabelText("Seans başlangıcı"), "2030-11-01T19:30");
  await user.type(screen.getByLabelText("Seans bitişi"), "2030-11-01T20:30");
  await user.type(screen.getByLabelText("Kontenjan"), "20");
  const submit = screen.getByRole("button", { name: "Telafi seansını oluştur" });
  expect(submit).toBeDisabled();
  await user.click(
    screen.getByLabelText("Kaynak seansı ve yeni rezervasyon gerektiğini onaylıyorum"),
  );
  await user.click(submit);
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "replacement_session_create_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      replaces_id: sampleSession.id,
      interval: { starts_at: "2030-11-01T16:30:00.000Z", ends_at: "2030-11-01T17:30:00.000Z" },
      resources: [{ kind: "room", id: "room" }],
      capacity: { total: 20, categories: null },
    },
  });
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("assignments");
  expect(mocks.saved).toHaveBeenCalledWith("replacement");
});
test("a non-cancelled source cannot create a replacement", () => {
  render(
    <ReplacementSession
      scope={scope}
      source={sampleSession}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  expect(screen.queryByRole("button", { name: "Telafi seansını oluştur" })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});

test("a pending replacement can be replayed when the live catalog is unavailable", async () => {
  const { setupStorageKey } = await import("../src/lib/studio-setup");
  const command = {
    operation: "replacement_session_create_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: "019a2b3c-4d5e-7000-8000-000000000005",
      replaces_id: sampleSession.id,
      interval: { starts_at: "2030-11-01T16:30:00Z", ends_at: "2030-11-01T17:30:00Z" },
      resources: [{ kind: "room", id: "room" }],
      capacity: { total: 0, categories: { male: 0, female: 0 } },
    },
  };
  sessionStorage.setItem(
    setupStorageKey(scope, `replacement:${sampleSession.id}`),
    JSON.stringify({ command }),
  );
  mocks.catalog.mockRejectedValue(Error("forbidden"));
  render(
    <ReplacementSession
      scope={scope}
      source={{ ...sampleSession, state: "cancelled" }}
      timeZone="Europe/Istanbul"
      onSaved={mocks.saved}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.send).toHaveBeenCalledWith(command);
});

test("replacement recovery reports the new session ID instead of inferring it from the source", async () => {
  const { setupStorageKey } = await import("../src/lib/studio-setup");
  const created = vi.fn<(id: string) => void>();
  const command = {
    operation: "replacement_session_create_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: "019a2b3c-4d5e-7000-8000-000000000006",
      replaces_id: sampleSession.id,
      interval: { starts_at: "2030-11-01T16:30:00Z", ends_at: "2030-11-01T17:30:00Z" },
      resources: [{ kind: "room", id: "room" }],
      capacity: { total: 0, categories: null },
    },
  };
  sessionStorage.setItem(
    setupStorageKey(scope, `replacement:${sampleSession.id}`),
    JSON.stringify({ command }),
  );
  const { ProgramRecovery } = await import("../src/components/programs/program-recovery");
  render(<ProgramRecovery scope={scope} onSaved={mocks.saved} onReplacementCreated={created} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(created).toHaveBeenCalledWith("replacement"));
});
