import { afterEach, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
import { readApplicationsPage, readLeadsPage, readStudentFollowups } from "./leads-read";
import { BackendError } from "../../lib/backend";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`,
  scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
afterEach(() => vi.resetAllMocks());
it("rejects unknown application state instead of labeling it closed", async () => {
  call.mockResolvedValue({
    items: [
      {
        entity: { type: "public_applications", id: id(4) },
        exists: true,
        state: null,
        versions: [{ entity: { type: "public_applications", id: id(4) }, version: 1 }],
        current: { operation: "public_application_review_v1", values: { application_id: id(4) } },
      },
    ],
  });
  await expect(readApplicationsPage(scope)).rejects.toThrow();
});
it("uses the permitted lead detail projection and filter summary without scanning people", async () => {
  call.mockImplementation(async (operation) => {
    if (operation === "leads_list_v1")
      return {
        items: [
          {
            id: id(4),
            person_id: id(5),
            assigned_to: null,
            version: 1,
            source: "phone",
            interest: "Tango",
            state: "open",
            last_contact: null,
            due_followup: null,
            display_name: "Örnek aday",
            assigned_name: null,
            created_at: "2026-11-17T12:00:00Z",
          },
        ],
        next_cursor: "page-two",
        summary: {
          total: 40,
          open_leads: 30,
          followups_today: 3,
          overdue_followups: 2,
          converted_last_30_days: 4,
        },
      };
    throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(9) });
  });
  const result = await readLeadsPage(scope, "Tango", "page-one");
  expect(result.items).toHaveLength(1);
  expect(result.items[0].display_name).toBe("Örnek aday");
  expect(result.summary?.total).toBe(40);
  expect(result.next_cursor).toBe("page-two");
  expect(call).toHaveBeenCalledTimes(1);
  expect(call.mock.calls[0][1]).toMatchObject({
    query: "Tango",
    include_details: true,
    include_summary: true,
    page: { limit: 20, cursor: "page-one" },
    org_id: scope.orgId,
    center_id: scope.centerId,
  });
});

it.each([null, id(7)])(
  "sends native assignment %s and stage filters with the requested cursor",
  async (assignedTo) => {
    call.mockResolvedValue({
      items: [],
      next_cursor: null,
      as_of: "2026-11-17T12:00:00Z",
      summary: {
        total: 25,
        open_leads: 20,
        followups_today: 4,
        overdue_followups: 2,
        converted_last_30_days: 1,
      },
    });
    const page = await readLeadsPage(scope, " Tango ", "native-cursor", {
      stage: "talk",
      assignedTo,
    });
    expect(call).toHaveBeenCalledExactlyOnceWith(
      "leads_list_v1",
      expect.objectContaining({
        query: "Tango",
        stage_key: "talk",
        assigned_to: assignedTo,
        page: { limit: 20, sort: "created_at_desc", cursor: "native-cursor" },
      }),
    );
    expect(page.summary?.total).toBe(25);
  },
);

it.each(["renewal_due", "inactive_student"] as const)(
  "reads native %s policy membership and only its visible person names",
  async (kind) => {
    call.mockImplementation(async (operation, request) =>
      operation === "crm_followup_list_v1"
        ? {
            items: [
              {
                id: id(8),
                person_id: id(5),
                center_id: scope.centerId,
                lead_id: null,
                assigned_to: null,
                kind,
                due_at: "2026-11-17T12:00:00Z",
              },
            ],
            next_cursor: "next",
            as_of: "2026-11-17T12:00:00Z",
          }
        : { id: request.person_id, display_name: "Görünür öğrenci" },
    );
    const page = await readStudentFollowups(scope, kind, "native-cursor");
    expect(page.items[0]).toMatchObject({
      name: "Görünür öğrenci",
      due_at: "2026-11-17T12:00:00Z",
    });
    expect(call.mock.calls[0]).toEqual([
      "crm_followup_list_v1",
      expect.objectContaining({
        org_id: scope.orgId,
        center_id: scope.centerId,
        kind,
        page: { limit: 20, sort: "due_at_asc", cursor: "native-cursor" },
      }),
    ]);
    expect(call).toHaveBeenCalledTimes(2);
  },
);
it("rejects a foreign-center student followup before reading any person", async () => {
  call.mockResolvedValue({
    items: [
      {
        id: id(8),
        person_id: id(5),
        center_id: id(99),
        lead_id: null,
        assigned_to: null,
        kind: "renewal_due",
        due_at: "2026-11-17T12:00:00Z",
      },
    ],
  });
  await expect(readStudentFollowups(scope, "renewal_due")).rejects.toThrow(
    "STUDENT_FOLLOWUP_UNAVAILABLE",
  );
  expect(call).toHaveBeenCalledTimes(1);
});
it("does not replace a forbidden student name with a private or invented identity", async () => {
  call.mockImplementation(async (operation) => {
    if (operation === "crm_followup_list_v1")
      return {
        items: [
          {
            id: id(8),
            person_id: id(5),
            center_id: scope.centerId,
            lead_id: null,
            assigned_to: null,
            kind: "renewal_due",
            due_at: "2026-11-17T12:00:00Z",
          },
        ],
        next_cursor: null,
      };
    throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(9) });
  });
  const page = await readStudentFollowups(scope, "renewal_due");
  expect(page.items).toHaveLength(1);
  expect(page.items[0].name).toBeUndefined();
  expect(call).toHaveBeenCalledTimes(2);
});
