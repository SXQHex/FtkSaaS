import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { getSetupRoles, getInstructorTasks } from "../src/lib/instructor-setup";
import { RoleSetup } from "../src/components/setup/role-setup";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  send: vi.fn<(command: import("../src/lib/studio-setup").SetupCommand) => Promise<unknown>>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  sendSetupCommand: mocks.send,
  getAvailability: async () => [],
  getClosures: async () => [],
}));
const scope = {
  actorId: "actor",
  orgId: "019a2b3c-4d5e-7000-8000-000000000001",
  centerId: "019a2b3c-4d5e-7000-8000-000000000002",
};
const assignment = "019a2b3c-4d5e-7000-8000-000000000003";
const person = "019a2b3c-4d5e-7000-8000-000000000004";
const row = {
  operation: "role_assign_v1",
  entity: { type: "role_assignments", id: assignment },
  exists: true,
  state: "active",
  versions: [{ entity: { type: "role_assignments", id: assignment }, version: 5 }],
  as_of: "2030-01-01T00:00:00Z",
  current: {
    operation: "role_assign_v1",
    values: { person_id: person, role: "instructor", scope: { center_id: scope.centerId } },
  },
};
const preview = {
  id: assignment,
  token: "synthetic-preview",
  expires_at: "2099-01-01T00:00:00Z",
  assignment_id: assignment,
  assignment_version: 5,
  sessions: [
    {
      session_id: person,
      starts_at: "2030-01-02T18:00:00Z",
      ends_at: "2030-01-02T19:00:00Z",
      version: 7,
      will_require_instructor: true,
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.send.mockResolvedValue({});
  mocks.call.mockImplementation(async (operation, input) => {
    if (operation === "subscription_get_v1") return { plan: "starter" };
    if (operation === "person_get_v1") return { display_name: "Synthetic Instructor" };
    if (operation === "role_revoke_preview_v1") return preview;
    if (operation === "management_state_get_v1" && input.operation === "role_assign_v1")
      return { items: [row], next_cursor: null };
    return { items: [], next_cursor: null };
  });
});
test("Starter discovers exact assignment/version through the narrow cursor selector without F05", async () => {
  mocks.call
    .mockResolvedValueOnce({ plan: "starter" })
    .mockResolvedValueOnce({ items: [row], next_cursor: "next" })
    .mockResolvedValueOnce({ items: [], next_cursor: null });
  expect(await getSetupRoles(scope)).toEqual([
    {
      id: assignment,
      person_id: person,
      role: "instructor",
      scope_center_id: scope.centerId,
      state: "active",
      version: 5,
    },
  ]);
  expect(mocks.call).toHaveBeenNthCalledWith(
    3,
    "management_state_get_v1",
    expect.objectContaining({
      operation: "role_assign_v1",
      center_id: scope.centerId,
      selector: {
        operation: "role_assign_v1",
        key: { role: "instructor", scope: { center_id: scope.centerId } },
      },
      page: expect.objectContaining({ cursor: "next" }),
    }),
  );
  expect(mocks.call.mock.calls.some(([op]) => op === "roles_list_v1")).toBe(false);
});
test("inconsistent assignment versions fail closed", async () => {
  mocks.call
    .mockResolvedValueOnce({ plan: "starter" })
    .mockResolvedValueOnce({ items: [{ ...row, versions: [] }], next_cursor: null });
  await expect(getSetupRoles(scope)).rejects.toThrow("Unreadable instructor assignment");
});
test("manager task discovery has no date cutoff and pages by session start", async () => {
  await getInstructorTasks(scope);
  expect(mocks.call).toHaveBeenCalledWith("management_state_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "session_assignment_set_v1",
    selector: { operation: "session_assignment_set_v1", key: {} },
    page: { limit: 50, sort: "starts_at_asc" },
  });
});
test("revocation requires effect preview then explicit approval and preserves reservations", async () => {
  const user = userEvent.setup();
  render(<RoleSetup scope={scope} onChanged={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Görevi kaldır" }));
  expect(
    screen.queryByRole("button", { name: "Görevi kaldırmayı onayla" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Etkilenen seansları incele" }));
  expect(await screen.findByText("Eğitmen atanmalı")).toBeVisible();
  await user.type(screen.getByLabelText("Kaldırma gerekçesi"), "Synthetic removal");
  await user.click(screen.getByRole("button", { name: "Görevi kaldırmayı onayla" }));
  expect(mocks.send).toHaveBeenCalledWith({
    operation: "role_revoke_v1",
    input: expect.objectContaining({
      assignment_id: assignment,
      expected_version: 5,
      reason: "Synthetic removal",
      impact_approval: { id: preview.id, token: preview.token },
    }),
  });
  expect(mocks.saved).toHaveBeenCalledOnce();
});

test("manual repair reads a fresh session and preserves its version and explicit instructor choice", async () => {
  const { InstructorTasks } = await import("../src/components/setup/instructor-tasks");
  const task = {
    operation: "session_assignment_set_v1",
    entity: { type: "sessions", id: person },
    exists: true,
    state: "planned",
    versions: [{ entity: { type: "sessions", id: person }, version: 7 }],
    as_of: "2030-01-01T00:00:00Z",
    management_attention: "instructor_required",
    session_detail: {
      id: person,
      version: 7,
      starts_at: "2030-01-02T18:00:00Z",
      ends_at: "2030-01-02T19:00:00Z",
      management_attention: "instructor_required",
    },
  };
  const base = mocks.call.getMockImplementation()!;
  mocks.call.mockImplementation(async (op, input) => {
    if (op === "management_state_get_v1" && input.operation === "session_assignment_set_v1")
      return { items: [task], next_cursor: null };
    if (op === "session_get_v1") return { ...task.session_detail, version: 9 };
    return base(op, input);
  });
  const user = userEvent.setup();
  render(<InstructorTasks scope={scope} centerName="Synthetic Center" />);
  await user.click(await screen.findByRole("button", { name: "Güncel seansı incele" }));
  await user.selectOptions(await screen.findByLabelText("Yeni eğitmen"), person);
  await user.click(screen.getByRole("button", { name: "Eğitmeni seansa ata" }));
  expect(mocks.send).toHaveBeenCalledWith({
    operation: "session_assignment_set_v1",
    input: expect.objectContaining({
      session_id: person,
      person_id: person,
      expected_version: 9,
      duty: "instructor",
      center_id: scope.centerId,
    }),
  });
  expect(
    mocks.call.mock.calls.filter(([op]) => op === "management_state_get_v1").length,
  ).toBeGreaterThan(2);
});

test("stale removal approval is discarded and a fresh review is required", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  mocks.send.mockRejectedValueOnce(
    new ApiFailure({
      ok: false,
      error: { code: "PREVIEW_STALE", retryable: false, trace_id: assignment },
    }),
  );
  const user = userEvent.setup();
  render(<RoleSetup scope={scope} onChanged={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Görevi kaldır" }));
  await user.click(screen.getByRole("button", { name: "Etkilenen seansları incele" }));
  await user.type(await screen.findByLabelText("Kaldırma gerekçesi"), "Synthetic removal");
  await user.click(screen.getByRole("button", { name: "Görevi kaldırmayı onayla" }));
  expect(await screen.findByText(/Etki listesi değişmiş/)).toHaveAttribute("role", "alert");
  expect(
    screen.queryByRole("button", { name: "Görevi kaldırmayı onayla" }),
  ).not.toBeInTheDocument();
  expect(mocks.saved).not.toHaveBeenCalled();
});

test("lost removal response recovers the exact approved payload after remount", async () => {
  mocks.send.mockRejectedValueOnce(new Error("Response lost"));
  const user = userEvent.setup();
  const view = render(<RoleSetup scope={scope} onChanged={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Görevi kaldır" }));
  await user.click(screen.getByRole("button", { name: "Etkilenen seansları incele" }));
  await user.type(await screen.findByLabelText("Kaldırma gerekçesi"), "Synthetic recovery");
  await user.click(screen.getByRole("button", { name: "Görevi kaldırmayı onayla" }));
  await screen.findByText(/Sonuç doğrulanamadı/);
  const original = mocks.send.mock.calls[0][0];
  view.unmount();
  render(<RoleSetup scope={scope} onChanged={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
  expect(mocks.saved).toHaveBeenCalledOnce();
});

test("a concurrently repaired session cannot open a new assignment form", async () => {
  const { InstructorTasks } = await import("../src/components/setup/instructor-tasks");
  const base = mocks.call.getMockImplementation()!;
  let repaired = false;
  mocks.call.mockImplementation(async (op, input) => {
    if (op === "management_state_get_v1" && input.operation === "session_assignment_set_v1")
      return {
        items: repaired
          ? []
          : [
              {
                operation: "session_assignment_set_v1",
                entity: { type: "sessions", id: person },
                exists: true,
                management_attention: "instructor_required",
                versions: [{ entity: { type: "sessions", id: person }, version: 7 }],
                session_detail: {
                  id: person,
                  version: 7,
                  starts_at: "2030-01-02T18:00:00Z",
                  ends_at: "2030-01-02T19:00:00Z",
                },
              },
            ],
        next_cursor: null,
      };
    if (op === "session_get_v1") {
      repaired = true;
      return { id: person, version: 9, state: "planned" };
    }
    return base(op, input);
  });
  const user = userEvent.setup();
  render(<InstructorTasks scope={scope} centerName="Synthetic Center" />);
  await user.click(await screen.findByRole("button", { name: "Güncel seansı incele" }));
  expect(await screen.findByText("Eğitmen atanması gereken seans yok.")).toBeVisible();
  expect(screen.queryByLabelText("Yeni eğitmen")).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
