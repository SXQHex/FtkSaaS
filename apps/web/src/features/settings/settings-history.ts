import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { SettingsLevel } from "./settings-document";

export async function readSettingsHistory(
  scope: ClientScope,
  level: SettingsLevel,
  cursor?: string,
) {
  const backend = await scopedBackend(scope);
  if (cursor !== undefined)
    z.string()
      .min(1)
      .max(2048)
      .regex(/^[a-f0-9]+$/)
      .parse(cursor);
  const page = await backend.call("settings_history_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    ...(level === "organization"
      ? { scope: "organization" as const }
      : { scope: "center" as const, center_id: scope.centerId }),
    ...(cursor ? { cursor } : {}),
  });
  z.iso.datetime({ offset: true }).parse(page.as_of);
  if (page.items.length > 50 || (cursor !== undefined && page.next_cursor === cursor))
    throw Error("SETTINGS_HISTORY_UNAVAILABLE");
  if (page.next_cursor != null)
    z.string()
      .min(1)
      .max(2048)
      .regex(/^[a-f0-9]+$/)
      .parse(page.next_cursor);
  const seen = new Set<string>();
  for (const row of page.items) {
    z.uuid().parse(row.id);
    z.uuid().parse(row.actor_account_id);
    z.iso.datetime({ offset: true }).parse(row.at);
    if (seen.has(row.id) || Date.parse(row.at) > Date.parse(page.as_of))
      throw Error("SETTINGS_HISTORY_UNAVAILABLE");
    seen.add(row.id);
  }
  return page;
}
