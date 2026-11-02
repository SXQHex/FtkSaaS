import type { PolicyKey, PolicyValue } from "@ftksaas/api-contracts";
export const setupPolicyKeys = [
  "student_cancel_private",
  "student_cancel_group",
  "reservation_window",
  "request_window",
  "negative_default",
  "negative_upper",
  "debt_booking",
  "debt_participation",
  "participation_block_credit",
] as const satisfies readonly PolicyKey[];
export type SetupPolicyKey = (typeof setupPolicyKeys)[number];
export function policyValue(key: SetupPolicyKey, data: FormData): PolicyValue {
  function count(name: string) {
    const raw = String(data.get(name) ?? "");
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw Error("invalidPolicy");
    return Number(raw);
  }
  function bool(name: string) {
    const raw = data.get(name);
    if (raw !== "true" && raw !== "false") throw Error("invalidPolicy");
    return raw === "true";
  }
  function effect(name: string) {
    const value = data.get(name);
    if (value !== "release" && value !== "consume") throw Error("invalidPolicy");
    return value;
  }
  switch (key) {
    case "negative_default":
    case "negative_upper":
      return { kind: "integer", value: count("value") };
    case "debt_booking":
    case "debt_participation":
      return { kind: "boolean", value: bool("value") };
    case "reservation_window":
    case "request_window": {
      const opens = count("opens"),
        closes = count("closes");
      if (opens < closes) throw Error("invalidPolicy");
      return {
        kind: "window",
        opens_minutes_before: opens,
        closes_minutes_before: closes,
        manager_exception: bool("manager"),
      };
    }
    case "participation_block_credit":
      return { kind: "blocked_credit", effect: effect("effect") };
    default:
      return {
        kind: "cancellation",
        terms: {
          cutoff_minutes: count("cutoff"),
          before_cutoff: effect("before"),
          after_cutoff: effect("after"),
          no_show: effect("noShow"),
        },
      };
  }
}
