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
export function errorMessage(error: unknown) {
  if (error instanceof ApiFailure) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Oturumun sona erdi. Yeniden giriş yap.",
      SESSION_REVOKED: "Oturumun kapatıldı. Yeniden giriş yap.",
      NOT_FOUND: "Bu kayda erişimin kalmamış olabilir. Bağlamını yeniden seç.",
      FORBIDDEN: "Bu işlem için yetkin yok.",
      SERVICE_UNAVAILABLE: "Hizmete şu anda ulaşılamıyor. Yeniden deneyebilirsin.",
    };
    return (
      messages[error.failure.error.code] ??
      "İşlem tamamlanamadı. Yeniden dene veya destekle iletişime geç."
    );
  }
  return "Bağlantı kurulamadı. İnternet bağlantını kontrol edip yeniden dene.";
}
