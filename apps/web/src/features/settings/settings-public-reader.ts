import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import { scopedBackend } from "../../lib/scoped-backend";
import type { SettingsLevel } from "./settings-document";
export async function readPublicForms(
  scope: ClientScope,
  level: SettingsLevel,
  cursor?: string,
  readContext?: AccountReadContext,
) {
  const target =
    level === "center"
      ? { scope: "center" as const, center_id: scope.centerId }
      : { scope: "organization" as const };
  const data = await (
    await scopedBackend(scope, undefined, readContext)
  ).call("settings_catalog_get_v1", {
    ...target,
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    include_configured_forms: true,
    configured_forms_page: { limit: 50, ...(cursor ? { cursor } : {}) },
  });
  if (
    data.scope !== level ||
    !data.configured_forms ||
    (cursor && data.configured_forms.next_cursor === cursor)
  )
    throw Error("PUBLIC_FORMS_UNAVAILABLE");
  const page = data.configured_forms;
  if (
    page.items.length > 50 ||
    new Set(page.items.map((row) => row.form_id)).size !== page.items.length
  )
    throw Error("PUBLIC_FORMS_UNAVAILABLE");
  for (const row of page.items) {
    z.uuid().parse(row.form_id);
    if (row.channel !== "web_form" || (level === "center" && row.center_id !== scope.centerId))
      throw Error("PUBLIC_FORMS_UNAVAILABLE");
  }
  return page;
}
export async function readPublicConsentSources(
  scope: ClientScope,
  level: SettingsLevel,
  code: string,
  readContext?: AccountReadContext,
) {
  const scopeKey =
    level === "center" ? `center:${scope.orgId}:${scope.centerId}` : `organization:${scope.orgId}`;
  const data = await (
    await scopedBackend(scope, undefined, readContext)
  ).call("content_catalog_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    ...(level === "center" ? { center_id: scope.centerId } : {}),
    scope_key: scopeKey,
    code: z
      .string()
      .regex(/^[a-z][a-z0-9_.-]{0,127}$/)
      .parse(code),
    channel: "document",
  });
  if (
    data.items.some(
      (row) =>
        row.scope_key !== scopeKey ||
        row.code !== code ||
        row.channel !== "document" ||
        typeof row.invalidated !== "boolean",
    )
  )
    throw Error("PUBLIC_CONSENT_SOURCE_INVALID");
  return data.items.filter((row) => row.state === "published" && !row.retired && !row.invalidated);
}
