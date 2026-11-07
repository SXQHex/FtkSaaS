import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { PersonnelPermissions } from "../src/components/setup/personnel-permissions";
import { PlanDowngrade } from "../src/components/subscription/plan-downgrade";
import { setupStorageKey } from "../src/lib/studio-setup";
import tr from "../messages/tr.json";
const mocks = vi.hoisted(() => ({
  call: vi.fn<(operation: string, input: Record<string, unknown>) => Promise<unknown>>(),
  send: vi.fn<
    (command: { operation: string; input: Record<string, unknown> }) => Promise<unknown>
  >(),
  centers: vi.fn<() => Promise<unknown>>(),
  resources: vi.fn<() => Promise<unknown>>(),
  students:
    vi.fn<
      (
        scope: import("../src/lib/studio-setup").SetupScope,
        query: string,
        cursor?: string,
      ) => Promise<unknown>
    >(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: mocks.call,
  sendSetupCommand: mocks.send,
}));
vi.mock("../src/lib/api", async (load) => ({
  ...(await load<typeof import("../src/lib/api")>()),
  getCenters: mocks.centers,
}));
vi.mock("../src/lib/plan-downgrade", async (load) => ({
  ...(await load<typeof import("../src/lib/plan-downgrade")>()),
  readRetentionResources: mocks.resources,
  readRetainedStudents: mocks.students,
}));
const scope = { actorId: v7(), orgId: v7() },
  center = v7(),
  person = v7(),
  target = v7(),
  subscription = v7(),
  change = v7(),
  room = v7(),
  discipline = v7(),
  instructor = v7();
function proof(op: string, id: string, type: string, values: object, version = 9) {
  return {
    items: [
      {
        operation: op,
        exists: true,
        entity: { type, id },
        state: op === "subscription_change_cancel_v1" ? "scheduled" : "active",
        versions: [{ entity: { type, id }, version }],
        current: { operation: op, values },
      },
    ],
    next_cursor: null,
  };
}
const nativePlan = () => ({
  plan: "pro",
  state: "active",
  subscription_version: 11,
  pending_change: null,
  billing: {
    current: { id: subscription, period: "monthly", currency: "TRY", amount_minor: "300000" },
    downgrade_options: [
      {
        plan: "starter",
        target: { id: target, period: "monthly", currency: "TRY", amount_minor: "100000" },
        effective_at: "2030-01-01T00:00:00Z",
        kept_center_required: true,
      },
    ],
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  mocks.send.mockResolvedValue({});
  mocks.centers.mockResolvedValue([
    { id: center, name: "Merkez A", state: "active", accessible: true },
  ]);
  mocks.resources.mockResolvedValue({
    rooms: [{ id: room, name: "Salon A" }],
    disciplines: [{ id: discipline, name: "Salsa" }],
    instructors: [{ id: instructor, name: "Eğitmen A" }],
  });
  mocks.students.mockImplementation(async (_scope, query, cursor) => ({
    items: cursor
      ? [{ id: change, display_name: "İkinci öğrenci", subscriber_number: 1062 }]
      : [{ id: person, display_name: "İlk öğrenci", subscriber_number: 1061 }],
    next_cursor: cursor || query ? null : "page2",
  }));
});
async function confirm(user: ReturnType<typeof userEvent.setup>) {
  const review = await screen.findByRole("region", { name: tr.flows.review });
  expect(within(review).getByRole("button", { name: tr.flows.apply })).toBeDisabled();
  await user.click(within(review).getByRole("checkbox", { name: tr.flows.confirm }));
  await user.click(within(review).getByRole("button", { name: tr.flows.apply }));
}
test("permission has no inferred role grant; explicit denial confirms real version and reads updated override", async () => {
  let written = false;
  mocks.call.mockImplementation(async () =>
    proof(
      "permission_set_v1",
      person,
      "people",
      {
        person_id: person,
        permission: "sale.write",
        override_exists: written,
        ...(written ? { enabled: false } : {}),
      },
      written ? 10 : 9,
    ),
  );
  mocks.send.mockImplementation(async () => {
    written = true;
    return {};
  });
  const user = userEvent.setup();
  render(<PersonnelPermissions scope={{ ...scope, centerId: center }} personId={person} />);
  expect(mocks.call).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: tr.personnelPermissions.title }));
  await user.selectOptions(screen.getByLabelText(tr.personnelPermissions.permission), "sale.write");
  await screen.findByText(tr.personnelPermissions.noOverride);
  expect(screen.getByRole("button", { name: tr.personnelPermissions.review })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText(tr.personnelPermissions.choice), "deny");
  await user.click(screen.getByRole("button", { name: tr.personnelPermissions.review }));
  expect(mocks.send).not.toHaveBeenCalled();
  await confirm(user);
  expect(mocks.send).toHaveBeenCalledWith({
    operation: "permission_set_v1",
    input: {
      org_id: scope.orgId,
      center_id: center,
      person_id: person,
      permission: "sale.write",
      enabled: false,
      expected_version: 9,
      operation_key: expect.any(String),
    },
  });
  await screen.findByText(tr.personnelPermissions.denied);
  expect(mocks.call).toHaveBeenCalledTimes(2);
});
test("lost permission response survives remount and replays exactly the saved key despite unavailable read", async () => {
  mocks.call.mockResolvedValue(
    proof("permission_set_v1", person, "people", {
      person_id: person,
      permission: "sale.write",
      override_exists: false,
    }),
  );
  mocks.send.mockRejectedValueOnce(Error("lost response")).mockResolvedValue({});
  const user = userEvent.setup();
  let view = render(
    <PersonnelPermissions scope={{ ...scope, centerId: center }} personId={person} />,
  );
  async function open() {
    await user.click(screen.getByRole("button", { name: tr.personnelPermissions.title }));
    await user.selectOptions(
      screen.getByLabelText(tr.personnelPermissions.permission),
      "sale.write",
    );
  }
  await open();
  await screen.findByText(tr.personnelPermissions.noOverride);
  await user.selectOptions(screen.getByLabelText(tr.personnelPermissions.choice), "allow");
  await user.click(screen.getByRole("button", { name: tr.personnelPermissions.review }));
  await confirm(user);
  await screen.findByText(tr.setup.uncertain);
  const original = mocks.send.mock.calls[0][0];
  const key = setupStorageKey({ ...scope, centerId: center }, `permission:${person}:sale.write`);
  expect(JSON.parse(sessionStorage.getItem(key)!).command).toEqual(original);
  view.unmount();
  mocks.call.mockRejectedValue(Error("FORBIDDEN"));
  view = render(<PersonnelPermissions scope={{ ...scope, centerId: center }} personId={person} />);
  await open();
  await user.click(await screen.findByRole("button", { name: tr.setup.retrySame }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.send.mock.calls[1][0]).toEqual(original);
  await waitFor(() => expect(sessionStorage.getItem(key)).toBeNull());
  view.unmount();
});
async function openDowngrade(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: tr.planChange.title }));
  await user.selectOptions(await screen.findByLabelText(tr.planChange.target), target);
  await user.selectOptions(screen.getByLabelText(tr.planChange.center), center);
  await screen.findByRole("option", { name: "Salon A" });
  await user.selectOptions(screen.getByLabelText(tr.planChange.rooms), room);
  await user.selectOptions(screen.getByLabelText(tr.planChange.disciplines), discipline);
  await user.selectOptions(screen.getByLabelText(tr.planChange.instructors), instructor);
}
test("downgrade retains explicit resources and students across pages, invalidates changed review, then rereads subscription", async () => {
  mocks.call.mockImplementation(async (op) =>
    op === "subscription_get_v1"
      ? nativePlan()
      : proof(
          "subscription_downgrade_request_v1",
          subscription,
          "saas_subscriptions",
          { target_plan_id: target },
          11,
        ),
  );
  const user = userEvent.setup();
  render(<PlanDowngrade scope={scope} />);
  await openDowngrade(user);
  await user.click(await screen.findByRole("checkbox", { name: "İlk öğrenci · 1061" }));
  await user.click(screen.getByRole("button", { name: tr.planChange.next }));
  await user.click(await screen.findByRole("checkbox", { name: "İkinci öğrenci · 1062" }));
  await user.click(screen.getByRole("button", { name: tr.planChange.review }));
  await screen.findByRole("region", { name: tr.flows.review });
  await user.click(
    screen.getByRole("button", { name: tr.planChange.remove.replace("{name}", "İlk öğrenci") }),
  );
  expect(screen.queryByRole("region", { name: tr.flows.review })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: tr.planChange.review }));
  await confirm(user);
  expect(mocks.send).toHaveBeenCalledWith({
    operation: "subscription_downgrade_request_v1",
    input: {
      org_id: scope.orgId,
      target_plan_id: target,
      kept_center_id: center,
      expected_version: 11,
      operation_key: expect.any(String),
      kept_scope: {
        room_id: room,
        discipline_id: discipline,
        instructor_id: instructor,
        student_person_ids: [change],
      },
    },
  });
  await waitFor(() =>
    expect(mocks.call.mock.calls.filter(([op]) => op === "subscription_get_v1")).toHaveLength(2),
  );
  expect(screen.getByLabelText(tr.planChange.target)).toHaveValue("");
});
test("no downgrade targets means no invented catalog; pending cancellation uses change request version", async () => {
  const plan = { ...nativePlan(), pending_change: { id: change, type: "saas_change_requests" } };
  plan.billing.downgrade_options = [];
  mocks.call.mockImplementation(async (op) =>
    op === "subscription_get_v1"
      ? plan
      : proof(
          "subscription_change_cancel_v1",
          change,
          "saas_change_requests",
          { change_id: change },
          4,
        ),
  );
  const user = userEvent.setup();
  render(<PlanDowngrade scope={scope} />);
  await user.click(screen.getByRole("button", { name: tr.planChange.title }));
  await screen.findByText(tr.planChange.noTargets);
  expect(screen.queryByLabelText(tr.planChange.center)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: tr.planChange.cancel }));
  await confirm(user);
  expect(mocks.send.mock.calls[0][0]).toMatchObject({
    operation: "subscription_change_cancel_v1",
    input: { org_id: scope.orgId, change_id: change, expected_version: 4 },
  });
});

test("a non-owner CM can discover personnel and edit permission independently of subscription access", async () => {
  const { PersonnelDirectory } = await import("../src/components/setup/personnel-permissions");
  mocks.call.mockImplementation(async (op) => {
    if (op === "subscription_get_v1") throw Error("FORBIDDEN");
    if (op === "roles_list_v1")
      return {
        items: [
          {
            id: target,
            person_id: person,
            role: "staff",
            scope_center_id: center,
            state: "active",
            version: 1,
          },
          {
            id: change,
            person_id: change,
            role: "assistant",
            scope_center_id: center,
            state: "active",
            version: 1,
          },
        ],
        next_cursor: null,
      };
    if (op === "person_get_v1") return { id: person, display_name: "Personel A" };
    return proof("permission_set_v1", person, "people", {
      person_id: person,
      permission: "sale.write",
      override_exists: false,
    });
  });
  const user = userEvent.setup();
  render(<PersonnelDirectory scope={{ ...scope, centerId: center }} />);
  await user.click(screen.getByRole("button", { name: tr.personnelPermissions.directory }));
  await screen.findByText("Personel A");
  await user.click(screen.getByRole("button", { name: tr.personnelPermissions.title }));
  await user.selectOptions(screen.getByLabelText(tr.personnelPermissions.permission), "sale.write");
  await screen.findByText(tr.personnelPermissions.noOverride);
  expect(mocks.call.mock.calls.some(([op]) => op === "subscription_get_v1")).toBe(false);
  expect(mocks.call.mock.calls.filter(([op]) => op === "person_get_v1")).toHaveLength(1);
});
test("an unavailable student reader requires deliberate zero-student consent and cannot silently submit empty retention", async () => {
  mocks.call.mockImplementation(async (op) =>
    op === "subscription_get_v1"
      ? nativePlan()
      : proof(
          "subscription_downgrade_request_v1",
          subscription,
          "saas_subscriptions",
          { target_plan_id: target },
          11,
        ),
  );
  mocks.students.mockRejectedValue(Error("FORBIDDEN"));
  const user = userEvent.setup();
  render(<PlanDowngrade scope={scope} />);
  await openDowngrade(user);
  expect(screen.getByRole("button", { name: tr.planChange.review })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: tr.planChange.noStudents }));
  await user.click(screen.getByRole("button", { name: tr.planChange.review }));
  await screen.findByRole("region", { name: tr.flows.review });
  expect(mocks.send).not.toHaveBeenCalled();
});
test("a changed subscription version blocks confirmation using old plan options", async () => {
  mocks.call.mockImplementation(async (op) =>
    op === "subscription_get_v1"
      ? nativePlan()
      : proof(
          "subscription_downgrade_request_v1",
          subscription,
          "saas_subscriptions",
          { target_plan_id: target },
          12,
        ),
  );
  const user = userEvent.setup();
  render(<PlanDowngrade scope={scope} />);
  await openDowngrade(user);
  await user.click(await screen.findByRole("checkbox", { name: "İlk öğrenci · 1061" }));
  await user.click(screen.getByRole("button", { name: tr.planChange.review }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("region", { name: tr.flows.review })).not.toBeInTheDocument();
  expect(mocks.send).not.toHaveBeenCalled();
});
test("student lookup forwards the typed subscriber number without converting it to a person identifier", async () => {
  mocks.call.mockImplementation(async (op) => (op === "subscription_get_v1" ? nativePlan() : {}));
  const user = userEvent.setup();
  render(<PlanDowngrade scope={scope} />);
  await openDowngrade(user);
  await user.type(screen.getByLabelText(tr.planChange.searchStudents), "1061");
  await user.click(screen.getByRole("button", { name: tr.planChange.search }));
  await waitFor(() =>
    expect(mocks.students).toHaveBeenLastCalledWith(
      { ...scope, centerId: center },
      "1061",
      undefined,
    ),
  );
  expect(mocks.send).not.toHaveBeenCalled();
});
