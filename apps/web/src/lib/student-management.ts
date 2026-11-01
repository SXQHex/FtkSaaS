import type { Operations, FailureEnvelope } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { apiClient, ApiFailure, getOperationStatus } from "./api";
type Input = Omit<
  Operations["person_discipline_set_v1"]["request"],
  "client_api_version" | "request_id"
>;
export async function listStudentDisciplines(orgId: string) {
  const items: Operations["disciplines_list_v1"]["response"]["data"]["items"] = [];
  let cursor: string | null = null;
  do {
    const result: Operations["disciplines_list_v1"]["response"] | FailureEnvelope =
      await apiClient().call("disciplines_list_v1", {
        client_api_version: 1,
        request_id: v7(),
        org_id: orgId,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      });
    if (!result.ok) throw new ApiFailure(result);
    items.push(...result.data.items);
    cursor = result.data.next_cursor;
  } while (cursor);
  return items;
}
export async function setStudentDiscipline(input: Input) {
  const result = await apiClient().call("person_discipline_set_v1", {
    client_api_version: 1,
    request_id: v7(),
    ...input,
  });
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export const disciplineActions = {
  list: listStudentDisciplines,
  save: setStudentDiscipline,
  status: getOperationStatus,
};
export type DisciplineActions = typeof disciplineActions;
export type DisciplineInput = Input;

export async function searchMergePeople(
  orgId: string,
  centerId: string,
  query: string,
  cursor?: string,
) {
  const result = await apiClient().call("people_list_v1", {
    client_api_version: 1,
    request_id: v7(),
    org_id: orgId,
    center_id: centerId,
    query,
    page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
  });
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export async function previewPersonMerge(
  input: Omit<
    Operations["person_merge_preview_v1"]["request"],
    "client_api_version" | "request_id"
  >,
) {
  const result = await apiClient().call("person_merge_preview_v1", {
    client_api_version: 1,
    request_id: v7(),
    ...input,
  });
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export type MergeInput = Omit<
  Operations["person_merge_apply_v1"]["request"],
  "client_api_version" | "request_id"
>;
export async function applyPersonMerge(input: MergeInput) {
  const result = await apiClient().call("person_merge_apply_v1", {
    client_api_version: 1,
    request_id: v7(),
    ...input,
  });
  if (!result.ok) throw new ApiFailure(result);
  return result.data;
}
export const mergeActions = {
  search: searchMergePeople,
  preview: previewPersonMerge,
  apply: applyPersonMerge,
  status: getOperationStatus,
};
export type MergeActions = typeof mergeActions;
