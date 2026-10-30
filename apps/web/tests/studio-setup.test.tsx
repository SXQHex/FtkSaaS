import { beforeEach, expect, test, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import type { OrganizationView } from "@ftksaas/api-contracts";
import { SourceForm, RoomCreate } from "../src/components/setup/source-forms";
import { AvailabilityEditor } from "../src/components/setup/availability-editor";
import { RoleSetup } from "../src/components/setup/role-setup";
import { StudioSetup } from "../src/components/setup/studio-setup";
import { setupStorageKey } from "../src/lib/studio-setup";
import { ApiFailure } from "../src/lib/api";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  send: vi.fn<
    (command: { operation: string; input: Record<string, unknown> }) => Promise<unknown>
  >(),
  saved: vi.fn<() => void>(),
  availability: vi.fn<() => Promise<import("@ftksaas/api-contracts").ManagementStateView[]>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  getAvailability: mocks.availability,
  sendSetupCommand: mocks.send,
}));
const scope = { actorId: "actor", orgId: "019a2b3c-4d5e-7000-8000-000000000002" };
const organization: OrganizationView = {
  id: scope.orgId,
  name: "Synthetic Studio",
  version: 4,
  access_mode: "normal",
  state: "active",
};
const center = {
  id: "019a2b3c-4d5e-7000-8000-000000000003",
  name: "Synthetic Center",
  version: 3,
  state: "active",
  accessible: true,
  timezone: "Europe/Istanbul",
};
const plan = {
  plan: "starter",
  state: "active",
  limits: { entries: [{ key: "rooms", value: 1 }] },
  usage: { entries: [{ key: "rooms", value: 0 }] },
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.availability.mockResolvedValue([]);
});
test("organization editing consumes the actual version and recovery reuses the exact name and key after remount", async () => {
  mocks.send.mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce({});
  const user = userEvent.setup();
  const view = render(
    <SourceForm
      scope={scope}
      target={{ kind: "organization", organization }}
      onSaved={mocks.saved}
    />,
  );
  await user.clear(screen.getByLabelText("Organizasyon adı"));
  await user.type(screen.getByLabelText("Organizasyon adı"), "Updated Studio");
  await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  await screen.findByRole("alert");
  const original = mocks.send.mock.calls[0][0];
  expect(original.input).toMatchObject({
    expected_version: 4,
    name: "Updated Studio",
    org_id: scope.orgId,
  });
  view.unmount();
  render(
    <SourceForm
      scope={scope}
      target={{ kind: "organization", organization: { ...organization, version: 8 } }}
      onSaved={mocks.saved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
  expect(mocks.saved).toHaveBeenCalledOnce();
});
test("creating a center has no invented version or center selector and uses an explicitly entered timezone", async () => {
  mocks.send.mockResolvedValue({});
  const user = userEvent.setup();
  render(<SourceForm scope={scope} target={{ kind: "center" }} onSaved={mocks.saved} />);
  expect(screen.getByLabelText("Merkezin saat dilimi")).toHaveValue("");
  await user.type(screen.getByLabelText("Merkez adı"), "New Center");
  await user.type(screen.getByLabelText("Merkezin saat dilimi"), "Europe/Istanbul");
  await user.click(screen.getByRole("button", { name: "Merkez oluştur" }));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "center_create_v1",
    input: { org_id: scope.orgId, name: "New Center", timezone: "Europe/Istanbul" },
  });
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("expected_version");
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("center_id");
});
test("permission loss after an uncertain write preserves recovery and prevents a new command", async () => {
  mocks.send.mockRejectedValueOnce(new Error("lost")).mockRejectedValueOnce(
    new ApiFailure({
      ok: false,
      error: { code: "FORBIDDEN", retryable: false, trace_id: scope.orgId },
    }),
  );
  const user = userEvent.setup();
  render(
    <SourceForm
      scope={scope}
      target={{ kind: "organization", organization }}
      onSaved={mocks.saved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(sessionStorage.getItem(setupStorageKey(scope, "organization"))).not.toBeNull();
  expect(screen.getByLabelText("Organizasyon adı")).toBeDisabled();
  expect(mocks.saved).not.toHaveBeenCalled();
});
test("storage failure stops room creation before transmission", async () => {
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  try {
    const user = userEvent.setup();
    render(<RoomCreate scope={{ ...scope, centerId: center.id }} onSaved={mocks.saved} />);
    await user.type(screen.getByLabelText("Oda adı"), "Room");
    await user.type(screen.getByLabelText("Fiziksel oda kapasitesi"), "40");
    await user.click(screen.getByRole("button", { name: "Oda oluştur" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("İşlem takibi");
    expect(mocks.send).not.toHaveBeenCalled();
  } finally {
    storage.mockRestore();
  }
});
test("bootstrap permits only center bootstrap actions and does not open discipline, role or room editing", async () => {
  mocks.call.mockImplementation(async (operation) => {
    if (operation === "organization_get_v1") return { ...organization, access_mode: "bootstrap" };
    if (operation === "centers_list_v1") return { items: [center], next_cursor: null };
    if (operation === "subscription_get_v1") return plan;
    throw new Error("unexpected operation");
  });
  render(
    <StudioSetup
      actorId="actor"
      organizations={[{ ...organization, access_mode: "bootstrap" }]}
      onChanged={mocks.saved}
    />,
  );
  expect(
    await screen.findByRole("button", { name: "Bu merkezin yöneticiliğini üstlen" }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Organizasyon adı")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Disiplinler" })).not.toBeInTheDocument();
  expect(
    mocks.call.mock.calls.some(([operation]) =>
      ["roles_list_v1", "disciplines_list_v1"].includes(operation),
    ),
  ).toBe(false);
});
test("unavailable subscription usage never enables first-room creation or claims complete setup", async () => {
  mocks.call.mockImplementation(async (operation) => {
    if (operation === "organization_get_v1") return organization;
    if (operation === "centers_list_v1") return { items: [center], next_cursor: null };
    if (
      operation === "disciplines_list_v1" ||
      operation === "roles_list_v1" ||
      operation === "people_list_v1"
    )
      return { items: [], next_cursor: null };
    throw new Error("not readable");
  });
  render(<StudioSetup actorId="actor" organizations={[organization]} onChanged={mocks.saved} />);
  expect(await screen.findByLabelText("Organizasyon adı")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Oda oluştur" })).not.toBeInTheDocument();
  expect(screen.getByText(/Kurulum henüz tamamlanmış olarak doğrulanmadı/)).toBeVisible();
});
test("late organization response cannot replace another selected organization's setup", async () => {
  const other = {
    ...organization,
    id: "019a2b3c-4d5e-7000-8000-000000000009",
    name: "Other Studio",
  };
  let finish!: (value: OrganizationView) => void;
  mocks.call.mockImplementation(async (operation, input) => {
    if (operation === "organization_get_v1") {
      if (input.org_id === organization.id)
        return new Promise((resolve) => {
          finish = resolve;
        });
      return other;
    }
    if (operation === "subscription_get_v1") return plan;
    return { items: [], next_cursor: null };
  });
  const user = userEvent.setup();
  render(
    <StudioSetup actorId="actor" organizations={[organization, other]} onChanged={mocks.saved} />,
  );
  await user.click(screen.getByRole("button", { name: "Synthetic Studio" }));
  await user.click(screen.getByRole("button", { name: "Other Studio" }));
  expect(await screen.findByLabelText("Organizasyon adı")).toHaveValue("Other Studio");
  await act(async () => {
    finish(organization);
  });
  expect(screen.getByLabelText("Organizasyon adı")).toHaveValue("Other Studio");
});

test("editing weekly availability uses the version of its own rule entity", async () => {
  const ruleId = "019a2b3c-4d5e-7000-8000-000000000022";
  mocks.availability.mockResolvedValue([
    {
      operation: "availability_save_v1",
      entity: { type: "availability_rules", id: ruleId },
      exists: true,
      state: "active",
      as_of: "2030-01-01T00:00:00Z",
      versions: [{ entity: { type: "availability_rules", id: ruleId }, version: 6 }],
      current: {
        operation: "availability_save_v1",
        values: {
          rule_id: ruleId,
          resource: { kind: "person", id: center.id },
          rule: {
            weekdays: [1],
            local_start: "19:00:00",
            local_end: "20:00:00",
            valid_from: "2030-01-01",
            valid_until: null,
          },
        },
      },
    },
  ]);
  mocks.send.mockResolvedValue({});
  const user = userEvent.setup();
  render(
    <AvailabilityEditor
      scope={{ ...scope, centerId: center.id }}
      resource={{ kind: "person", id: center.id }}
    />,
  );
  const heading = await screen.findByRole("heading", { name: "Uygunluk kuralını düzenle" });
  const form = heading.closest("form")!;
  await user.click(within(form).getByRole("button", { name: "Uygunluğu kaydet" }));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "availability_save_v1",
    input: {
      org_id: scope.orgId,
      center_id: center.id,
      rule_id: ruleId,
      expected_version: 6,
      rule: { local_start: "19:00:00", local_end: "20:00:00" },
    },
  });
});

test("instructor revocation uses the actual scoped assignment and reason", async () => {
  const assignment = "019a2b3c-4d5e-7000-8000-000000000033";
  mocks.call.mockImplementation(async (operation) => {
    if (operation === "roles_list_v1")
      return {
        items: [
          {
            id: assignment,
            person_id: center.id,
            role: "instructor",
            scope_center_id: center.id,
            state: "active",
            version: 5,
          },
        ],
        next_cursor: null,
      };
    if (operation === "person_get_v1") return { display_name: "Synthetic Instructor" };
    return { items: [], next_cursor: null };
  });
  mocks.send.mockResolvedValue({});
  const user = userEvent.setup();
  render(<RoleSetup scope={{ ...scope, centerId: center.id }} onChanged={mocks.saved} />);
  await user.click(await screen.findByRole("button", { name: "Görevi kaldır" }));
  await user.type(screen.getByLabelText("Kaldırma gerekçesi"), "Görev sona erdi");
  await user.click(screen.getByRole("button", { name: "Görevi kaldırmayı onayla" }));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "role_revoke_v1",
    input: {
      org_id: scope.orgId,
      center_id: center.id,
      assignment_id: assignment,
      expected_version: 5,
      reason: "Görev sona erdi",
    },
  });
});
