import { beforeEach, expect, test, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import type { OrganizationView } from "@ftksaas/api-contracts";
import { SourceForm, RoomCreate } from "../src/components/setup/source-forms";
import { AvailabilityEditor } from "../src/components/setup/availability-editor";
import { RoleSetup } from "../src/components/setup/role-setup";
import { StudioSetup } from "../src/components/setup/studio-setup";
import { RoomSetup } from "../src/components/setup/room-setup";
import { ExceptionForm } from "../src/components/setup/exception-form";
import { PolicySetup } from "../src/components/setup/policy-setup";
import { SetupChecklist } from "../src/components/setup/setup-checklist";
import { setupStorageKey } from "../src/lib/studio-setup";
import { ApiFailure } from "../src/lib/api";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  send: vi.fn<
    (command: { operation: string; input: Record<string, unknown> }) => Promise<unknown>
  >(),
  saved: vi.fn<() => void>(),
  availability: vi.fn<() => Promise<import("@ftksaas/api-contracts").ManagementStateView[]>>(),
  rooms: vi.fn<() => Promise<import("@ftksaas/api-contracts").ManagementStateView[]>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  getAvailability: mocks.availability,
  getRooms: mocks.rooms,
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
  mocks.rooms.mockResolvedValue([]);
});
test("Starter policy publication uses organization scope and an explicit false value", async () => {
  mocks.call.mockResolvedValue([
    {
      key: "debt_booking",
      scope: { kind: "organization" },
      value: { kind: "boolean", value: true },
      effective_at: "2030-01-01T00:00:00Z",
      mandatory: false,
      version: 7,
    },
  ]);
  mocks.send.mockResolvedValue({});
  const user = userEvent.setup();
  render(<PolicySetup scope={scope} />);
  await user.click(await screen.findByText("Borçla rezervasyon"));
  const form = screen.getByText("Borçla rezervasyon").closest("details")!.querySelector("form")!;
  await user.selectOptions(within(form).getByLabelText("Politika seçimi"), "false");
  await user.type(
    within(form).getByLabelText("Yürürlük zamanı (UTC farkıyla)"),
    "2030-01-01T12:00:00+03:00",
  );
  await user.click(within(form).getByRole("button", { name: "Yeni politika sürümünü yayımla" }));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "policy_publish_v1",
    input: {
      org_id: scope.orgId,
      key: "debt_booking",
      value: { kind: "boolean", value: false },
      effective_at: "2030-01-01T09:00:00.000Z",
      mandatory: false,
    },
  });
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("center_id");
  expect(mocks.send.mock.calls[0][0].input).not.toHaveProperty("expected_version");
});
test("the checklist never substitutes discipline counts for an unreadable center link", async () => {
  mocks.call.mockResolvedValue({ items: [], next_cursor: null });
  mocks.call.mockImplementation(async (operation) =>
    operation === "policies_get_v1" ? [] : { items: [], next_cursor: null },
  );
  const user = userEvent.setup();
  render(<SetupChecklist scope={{ ...scope, centerId: center.id }} timezone="Europe/Istanbul" />);
  await user.click(screen.getByRole("button", { name: "Kurulumu kontrol et" }));
  expect(await screen.findByText(/Disiplinin merkezle güncel/)).toBeVisible();
  expect(screen.getByText(/Kurulum henüz tamamlanmış olarak doğrulanmadı/)).toBeVisible();
  expect(screen.getAllByText("Kurulum gerekiyor")).toHaveLength(5);
});
test("an expired result stays blocked when persisting the block fails", async () => {
  mocks.send.mockRejectedValue(new Error("lost"));
  mocks.call.mockImplementation(async (_operation, input) => ({
    status: "result_expired",
    operation: input.operation,
    key: input.key,
  }));
  const user = userEvent.setup();
  render(
    <SourceForm
      scope={scope}
      target={{ kind: "organization", organization }}
      onSaved={mocks.saved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("storage blocked");
  });
  try {
    await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
    expect(
      screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
    ).not.toBeInTheDocument();
    expect(mocks.send).toHaveBeenCalledOnce();
  } finally {
    blocked.mockRestore();
  }
});
test.each(["operation", "key"])(
  "a status receipt with another %s cannot clear the pending write",
  async (field) => {
    mocks.send.mockRejectedValue(new Error("lost"));
    mocks.call.mockImplementation(async (_operation, input) => ({
      status: "succeeded",
      operation: field === "operation" ? "room_save_v1" : input.operation,
      key: field === "key" ? scope.orgId : input.key,
    }));
    const user = userEvent.setup();
    render(
      <SourceForm
        scope={scope}
        target={{ kind: "organization", organization }}
        onSaved={mocks.saved}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
    await user.click(await screen.findByRole("button", { name: "İşlem sonucunu kontrol et" }));
    expect(sessionStorage.getItem(setupStorageKey(scope, "organization"))).not.toBeNull();
    expect(screen.getByLabelText("Organizasyon adı")).toBeDisabled();
    expect(mocks.saved).not.toHaveBeenCalled();
  },
);
test("a late write cannot refresh or announce success in another account context", async () => {
  let complete!: () => void;
  mocks.send.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = () => resolve({});
      }),
  );
  const user = userEvent.setup();
  const view = render(
    <SourceForm
      scope={scope}
      target={{ kind: "organization", organization }}
      onSaved={mocks.saved}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));
  view.unmount();
  await act(async () => {
    complete();
  });
  expect(mocks.saved).not.toHaveBeenCalled();
});
test("a closure appends with the freshly read center aggregate version and explicit interval", async () => {
  mocks.call.mockResolvedValue({ items: [{ ...center, version: 17 }], next_cursor: null });
  mocks.send.mockResolvedValue({});
  const user = userEvent.setup();
  render(
    <ExceptionForm
      scope={{ ...scope, centerId: center.id }}
      resource={{ kind: "room", id: center.id }}
    />,
  );
  await user.type(await screen.findByLabelText("Kapanış başlangıcı"), "2030-10-27T02:30:00+02:00");
  await user.type(screen.getByLabelText("Kapanış bitişi"), "2030-10-27T02:30:00+01:00");
  await user.type(screen.getByLabelText("Kapanış gerekçesi"), "Bakım");
  await user.click(screen.getByRole("button", { name: "Kapanışı kaydet" }));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "availability_exception_save_v1",
    input: {
      center_id: center.id,
      expected_version: 17,
      interval: { starts_at: "2030-10-27T00:30:00.000Z", ends_at: "2030-10-27T01:30:00.000Z" },
      reason: "Bakım",
    },
  });
});
test("existing rooms edit with their own version and preserve zero capacity", async () => {
  mocks.rooms.mockResolvedValue([
    {
      operation: "room_save_v1",
      exists: true,
      state: "active",
      entity: { type: "rooms", id: center.id },
      versions: [{ entity: { type: "rooms", id: center.id }, version: 9 }],
      as_of: "2030-01-01T00:00:00Z",
      current: {
        operation: "room_save_v1",
        values: { room_id: center.id, name: "Studio room", capacity: 0 },
      },
    },
  ]);
  mocks.send.mockResolvedValue({});
  const user = userEvent.setup();
  render(<RoomSetup scope={{ ...scope, centerId: center.id }} onChanged={mocks.saved} />);
  await user.click(await screen.findByText("Studio room"));
  const form = screen.getByText("Studio room").closest("details")!.querySelector("form")!;
  expect(within(form).getByLabelText("Fiziksel oda kapasitesi")).toHaveValue(0);
  await user.click(within(form).getByRole("button", { name: "Değişiklikleri kaydet" }));
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "room_save_v1",
    input: { room_id: center.id, expected_version: 9, capacity: 0 },
  });
});
test("create and edit forms keep every label bound to its own field", () => {
  render(
    <>
      <SourceForm scope={scope} target={{ kind: "center" }} onSaved={mocks.saved} />
      <SourceForm
        scope={scope}
        target={{ kind: "center", center: { ...center, state: "active" } }}
        onSaved={mocks.saved}
      />
      <RoomCreate scope={scope} onSaved={mocks.saved} />
      <RoomCreate scope={scope} onSaved={mocks.saved} />
    </>,
  );
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label[for]"));
  expect(labels.length).toBe(8);
  for (const label of labels) {
    expect(document.getElementById(label.htmlFor)?.closest("form")).toBe(label.closest("form"));
  }
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
test("failed room discovery never enables room creation or claims complete setup", async () => {
  mocks.rooms.mockRejectedValue(new Error("room discovery unavailable"));
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
    if (operation === "policies_get_v1") return [];
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
            local_start: "19:00:30",
            local_end: "20:00:30",
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
      rule: { local_start: "19:00:30", local_end: "20:00:30" },
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
