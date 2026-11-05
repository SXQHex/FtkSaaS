import { documentReadActions } from "./document-requirements";
import type { BookingMode, LessonRequestView } from "@ftksaas/api-contracts";
import { ApiFailure, getStudents, getCalendar, getSession } from "./api";
import { setupCall, type SetupScope } from "./studio-setup";
import { getSetupRoles } from "./instructor-setup";
import { productDisciplines } from "./products";
export const bookingApi = {
  documents: documentReadActions,
  capacity: async (scope: SetupScope, person_id: string, session_id: string) => {
    try {
      await setupCall("management_state_get_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation: "reservation_capacity_override_v1",
        selector: { operation: "reservation_capacity_override_v1", key: { person_id, session_id } },
      });
      return true;
    } catch (cause) {
      if (
        cause instanceof ApiFailure &&
        ["FORBIDDEN", "NOT_FOUND"].includes(cause.failure.error.code)
      )
        return false;
      throw cause;
    }
  },
  requestActions: async (scope: SetupScope, row: LessonRequestView) => {
    const candidates = [
      {
        action: "withdraw",
        operation: "lesson_request_withdraw_v1",
        selector: { operation: "lesson_request_withdraw_v1", key: { lesson_request_id: row.id } },
      },
      {
        action: "reject",
        operation: "lesson_request_reject_v1",
        selector: { operation: "lesson_request_reject_v1", key: { lesson_request_id: row.id } },
      },
      {
        action: "offer_alternative",
        operation: "lesson_request_offer_alternative_v1",
        selector: {
          operation: "lesson_request_offer_alternative_v1",
          key: { lesson_request_id: row.id },
        },
      },
      {
        action: "approve",
        operation: "lesson_request_approve_v1",
        selector: { operation: "lesson_request_approve_v1", key: { lesson_request_id: row.id } },
      },
    ] as const;
    const allowed: string[] = [];
    async function inspect(
      operation: (typeof candidates)[number]["operation"] | "lesson_request_accept_alternative_v1",
      selector:
        | (typeof candidates)[number]["selector"]
        | {
            operation: "lesson_request_accept_alternative_v1";
            key: { lesson_request_id: string; alternative_id: string };
          },
      action: string,
    ) {
      try {
        const result = await setupCall("management_state_get_v1", {
          org_id: scope.orgId,
          center_id: scope.centerId,
          operation,
          selector,
        });
        const match = result.items.find(
          (item) => item.operation === operation && item.request_detail?.id === row.id,
        );
        if (!match) return;
        if (
          match.request_detail?.person_id !== row.person_id ||
          match.request_detail?.center_id !== scope.centerId
        )
          throw Error("invalidForm");
        if (match.request_detail?.version !== row.version) throw Error("VERSION_CONFLICT");
        allowed.push(action);
      } catch (cause) {
        if (
          !(
            cause instanceof ApiFailure &&
            ["FORBIDDEN", "NOT_FOUND"].includes(cause.failure.error.code)
          )
        )
          throw cause;
      }
    }
    await Promise.all(
      candidates.map((candidate) =>
        inspect(candidate.operation, candidate.selector, candidate.action),
      ),
    );
    const alternative = row.alternatives.find((item) => item.state === "offered");
    if (alternative)
      await inspect(
        "lesson_request_accept_alternative_v1",
        {
          operation: "lesson_request_accept_alternative_v1",
          key: { lesson_request_id: row.id, alternative_id: alternative.id },
        },
        "accept_alternative",
      );
    return [...candidates.map((candidate) => candidate.action), "accept_alternative"].filter(
      (action) => allowed.includes(action),
    );
  },
  catalog: async (scope: SetupScope) => {
    const [disciplines, roles] = await Promise.all([
      productDisciplines(scope),
      getSetupRoles(scope),
    ]);
    const ids = [
      ...new Set(
        roles
          .filter(
            (role) =>
              role.role === "instructor" &&
              role.state === "active" &&
              role.scope_center_id === scope.centerId,
          )
          .map((role) => role.person_id),
      ),
    ];
    const people = await Promise.all(
      ids.map((person_id) =>
        setupCall("person_get_v1", { org_id: scope.orgId, center_id: scope.centerId, person_id }),
      ),
    );
    return {
      disciplines: disciplines.map((row) => ({ id: row.id, name: row.name })),
      instructors: people.map((row) => ({ id: row.id, name: row.display_name })),
    };
  },
  people: (scope: SetupScope, query: string, cursor?: string) => {
    if (!scope.centerId) throw Error("invalidForm");
    return getStudents({ orgId: scope.orgId, centerId: scope.centerId, query, cursor });
  },
  rights: (scope: SetupScope, personId: string, sessionId: string, mode: BookingMode) =>
    setupCall("entitlements_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      session_id: sessionId,
      booking_mode: mode,
      include_timed_rights: true,
    }),
  reservations: (scope: SetupScope, sessionId: string, cursor?: string) =>
    setupCall("reservation_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      session_id: sessionId,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    }),
  requests: async (scope: SetupScope, personId: string, cursor?: string) => {
    const result = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "lesson_request_create_v1",
      selector: { operation: "lesson_request_create_v1", key: { person_id: personId } },
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const rows: LessonRequestView[] = [];
    for (const item of result.items) {
      const row = item.request_detail;
      if (
        item.operation !== "lesson_request_create_v1" ||
        !row ||
        row.person_id !== personId ||
        row.center_id !== scope.centerId ||
        item.entity?.id !== row.id
      )
        throw Error("invalidForm");
      rows.push(row);
    }
    return { ...result, items: rows };
  },
  disciplines: productDisciplines,
  calendar: getCalendar,
  session: getSession,
};
export type BookingApi = typeof bookingApi;
