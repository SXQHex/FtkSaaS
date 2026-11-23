import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import type { PolicyKey } from "@ftksaas/api-contracts";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import type { SettingsLevel } from "./settings-document";

export const settingsPolicyKeys = [
  "student_cancel_private",
  "student_cancel_group",
  "reservation_window",
  "request_window",
  "negative_default",
  "negative_upper",
  "debt_booking",
  "debt_participation",
  "freeze_default",
  "waitlist_offer_minutes",
  "class_reminder_hours",
  "entitlement_reminder_days",
  "trial_repeat_limit",
  "inactive_student_days",
  "participation_block_credit",
  "negative_valuation",
  "mandatory_document",
  "sensitive_money_upper",
  "sensitive_credit_upper",
  "sale_discount_percent_upper",
] as const satisfies readonly PolicyKey[];

/** The native reader returns the effective policy, including mandatory organization inheritance. */
export async function readSettingsPolicies(
  scope: ClientScope,
  level: SettingsLevel,
  readContext?: AccountReadContext,
) {
  const items = await (
    await scopedBackend(scope, undefined, readContext)
  ).call("policies_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    ...(level === "center" ? { center_id: scope.centerId } : {}),
    keys: [...settingsPolicyKeys],
  });
  const seen = new Set<PolicyKey>();
  for (const item of items) {
    if (
      !settingsPolicyKeys.some((key) => key === item.key) ||
      seen.has(item.key) ||
      (item.scope.kind === "organization" && item.scope.center_id != null) ||
      (item.scope.kind === "center" &&
        (level !== "center" || item.scope.center_id !== scope.centerId))
    )
      throw Error("SETTINGS_POLICY_SOURCE_UNAVAILABLE");
    seen.add(item.key);
    z.number().int().positive().safe().parse(item.version);
    z.iso.datetime({ offset: true }).parse(item.effective_at);
    z.boolean().parse(item.mandatory);
  }
  return { scope: { ...scope }, level, items };
}
