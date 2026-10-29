import { createBackendClient } from "@ftksaas/api-contracts/client";
import type { FailureEnvelope, Operations, UserSettingsValues } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { publicConfig } from "./config";
import { browserClient } from "./supabase/client";

export class ApiFailure extends Error {
  constructor(readonly failure: FailureEnvelope) {
    super(failure.error.code);
  }
}
export function apiClient() {
  const config = publicConfig();
  if (!config) throw new Error("API bağlantısı yapılandırılmadı.");
  return createBackendClient({
    functionsUrl: `${config.url}/functions/v1/backend-v1`,
    publishableKey: config.publishableKey,
    getAccessToken: async () => {
      const { data, error } = await browserClient().auth.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
  });
}
const request = () => ({ client_api_version: 1 as const, request_id: v7() });
function unwrap<T extends { ok: true; data: unknown }>(result: T | FailureEnvelope): T["data"] {
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export async function getAccount() {
  return unwrap<Operations["account_get_v1"]["response"]>(
    await apiClient().call("account_get_v1", request()),
  );
}
export async function getUserSettings() {
  const data = unwrap<Operations["settings_get_v1"]["response"]>(
    await apiClient().call("settings_get_v1", { ...request(), scope: "user" }),
  );
  return data.values as UserSettingsValues;
}
export async function getOrganizations() {
  const items: Operations["organizations_list_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = unwrap<Operations["organizations_list_v1"]["response"]>(
      await apiClient().call("organizations_list_v1", {
        ...request(),
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      }),
    );
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}
export async function getCenters(orgId: string) {
  const items: Operations["centers_list_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = unwrap<Operations["centers_list_v1"]["response"]>(
      await apiClient().call("centers_list_v1", {
        ...request(),
        org_id: orgId,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      }),
    );
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return items;
}
export async function getCalendar(
  query: Pick<Operations["calendar_get_v1"]["request"], "org_id" | "center_id" | "interval">,
) {
  const items: Operations["calendar_get_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null | undefined;
  do {
    const data = unwrap<Operations["calendar_get_v1"]["response"]>(
      await apiClient().call("calendar_get_v1", {
        ...request(),
        ...query,
        page: { limit: 200, sort: "starts_at_asc", ...(cursor ? { cursor } : {}) },
      }),
    );
    items.push(...data.items);
    cursor = data.next_cursor;
  } while (cursor);
  return [...new Map(items.map((item) => [`${item.type}:${item.id}`, item])).values()];
}
export async function getSession(orgId: string, centerId: string | undefined, sessionId: string) {
  return unwrap<Operations["session_get_v1"]["response"]>(
    await apiClient().call("session_get_v1", {
      ...request(),
      org_id: orgId,
      ...(centerId ? { center_id: centerId } : {}),
      session_id: sessionId,
    }),
  );
}
export async function previewSessionChange(
  input: Omit<
    Operations["session_change_preview_v1"]["request"],
    "client_api_version" | "request_id"
  >,
) {
  return unwrap<Operations["session_change_preview_v1"]["response"]>(
    await apiClient().call("session_change_preview_v1", { ...request(), ...input }),
  );
}
export async function applySessionChange(
  input: Omit<
    Operations["session_change_apply_v1"]["request"],
    "client_api_version" | "request_id"
  >,
) {
  return unwrap<Operations["session_change_apply_v1"]["response"]>(
    await apiClient().call("session_change_apply_v1", { ...request(), ...input }),
  );
}
export async function getSessionChangeStatus(orgId: string, key: string) {
  return unwrap<Operations["operation_status_get_v1"]["response"]>(
    await apiClient().call("operation_status_get_v1", {
      ...request(),
      org_id: orgId,
      operation: "session_change_apply_v1",
      key,
    }),
  );
}
export async function getStudents(input: {
  orgId: string;
  centerId: string;
  query: string;
  cursor?: string;
}) {
  return unwrap<Operations["people_list_v1"]["response"]>(
    await apiClient().call("people_list_v1", {
      ...request(),
      org_id: input.orgId,
      center_id: input.centerId,
      relationship: "student",
      ...(input.query ? { query: input.query } : {}),
      page: {
        limit: 25,
        sort: "created_at_asc",
        ...(input.cursor ? { cursor: input.cursor } : {}),
      },
    }),
  );
}
export async function getPerson(orgId: string, centerId: string, personId: string) {
  return unwrap<Operations["person_get_v1"]["response"]>(
    await apiClient().call("person_get_v1", {
      ...request(),
      org_id: orgId,
      center_id: centerId,
      person_id: personId,
    }),
  );
}
export async function updatePerson(
  input: Omit<Operations["person_update_v1"]["request"], "client_api_version" | "request_id">,
) {
  return unwrap<Operations["person_update_v1"]["response"]>(
    await apiClient().call("person_update_v1", { ...request(), ...input }),
  );
}
export async function createPerson(
  input: Omit<Operations["person_create_v1"]["request"], "client_api_version" | "request_id">,
) {
  return unwrap<Operations["person_create_v1"]["response"]>(
    await apiClient().call("person_create_v1", { ...request(), ...input }),
  );
}
export type PersonCreateCommand = {
  operation: "person_create_v1";
  input: Omit<Operations["person_create_v1"]["request"], "client_api_version" | "request_id">;
};
export async function sendAccountInvitation(
  input: Omit<Operations["account_access_send_v1"]["request"], "client_api_version" | "request_id">,
) {
  return unwrap<Operations["account_access_send_v1"]["response"]>(
    await apiClient().call("account_access_send_v1", { ...request(), ...input }),
  );
}
export type AccountInvitationCommand = {
  operation: "account_access_send_v1";
  input: Omit<Operations["account_access_send_v1"]["request"], "client_api_version" | "request_id">;
};
export async function getJobStatus(orgId: string, centerId: string, jobId: string) {
  return unwrap<Operations["job_status_get_v1"]["response"]>(
    await apiClient().call("job_status_get_v1", {
      ...request(),
      org_id: orgId,
      center_id: centerId,
      job_id: jobId,
    }),
  );
}
export type PersonUpdateCommand = {
  operation: "person_update_v1";
  input: Omit<Operations["person_update_v1"]["request"], "client_api_version" | "request_id">;
};
export type StudentOperation = "student_activate_v1" | "student_deactivate_v1" | "person_update_v1";
export type StudentCommand =
  | {
      operation: "student_activate_v1";
      input: Omit<
        Operations["student_activate_v1"]["request"],
        "client_api_version" | "request_id"
      >;
    }
  | {
      operation: "student_deactivate_v1";
      input: Omit<
        Operations["student_deactivate_v1"]["request"],
        "client_api_version" | "request_id"
      >;
    };
export async function changeStudent(command: StudentCommand) {
  const result =
    command.operation === "student_activate_v1"
      ? await apiClient().call(command.operation, { ...request(), ...command.input })
      : await apiClient().call(command.operation, { ...request(), ...command.input });
  return unwrap<Operations["student_activate_v1"]["response"]>(result);
}
export async function getStudentChangeStatus(
  orgId: string,
  operation: StudentOperation,
  key: string,
) {
  return unwrap<Operations["operation_status_get_v1"]["response"]>(
    await apiClient().call("operation_status_get_v1", {
      ...request(),
      org_id: orgId,
      operation,
      key,
    }),
  );
}
export async function getOperationStatus(
  orgId: string,
  operation: Operations["operation_status_get_v1"]["request"]["operation"],
  key: string,
) {
  return unwrap<Operations["operation_status_get_v1"]["response"]>(
    await apiClient().call("operation_status_get_v1", {
      ...request(),
      org_id: orgId,
      operation,
      key,
    }),
  );
}
export function errorMessageKey(error: unknown) {
  if (!(error instanceof ApiFailure)) return "network";
  const code = error.failure.error.code;
  return [
    "AUTH_REQUIRED",
    "SESSION_REVOKED",
    "NOT_FOUND",
    "FORBIDDEN",
    "SERVICE_UNAVAILABLE",
  ].includes(code)
    ? code
    : "unknown";
}
