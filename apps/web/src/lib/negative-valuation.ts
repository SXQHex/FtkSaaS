import { validate } from "uuid";
import type { ManagementStateView, SessionFormat } from "@ftksaas/api-contracts";
import { money } from "./collection-command";
import { getCenters } from "./api";
import { productDisciplines } from "./products";
import { setupCall, type SetupScope } from "./studio-setup";
export const valuationApi = {
  context: async (scope: SetupScope) => {
    const [plan, disciplines, centers] = await Promise.all([
      setupCall("subscription_get_v1", { org_id: scope.orgId }),
      productDisciplines(scope),
      getCenters(scope.orgId),
    ]);
    const center = centers.find(
      (c) => c.id === scope.centerId && c.accessible && c.state === "active",
    );
    if (!center || !["pro", "business"].includes(plan.plan)) throw Error("unavailableValuation");
    return { disciplines, timeZone: center.timezone };
  },
  read: (scope: SetupScope, disciplineId: string, format: SessionFormat) =>
    setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "negcredit_valuation_set_v1",
      selector: {
        operation: "negcredit_valuation_set_v1",
        key: { discipline_id: disciplineId, format },
      },
      page: { limit: 1, sort: "created_at_asc" },
    }),
};
export function valuationVersion(
  items: ManagementStateView[],
  centerId: string,
  disciplineId: string,
  format: SessionFormat,
) {
  if (items.length !== 1) throw Error("invalidValuation");
  const row = items[0],
    current = row.current?.operation === "negcredit_valuation_set_v1" ? row.current.values : null;
  const version = row.versions.find(
    (v) => v.entity.type === "centers" && v.entity.id === centerId,
  )?.version;
  if (
    row.operation !== "negcredit_valuation_set_v1" ||
    row.entity?.type !== "centers" ||
    row.entity.id !== centerId ||
    !Number.isSafeInteger(version) ||
    !version ||
    version < 1 ||
    !current ||
    (row.exists &&
      (current.discipline_id !== disciplineId ||
        current.format !== format ||
        !money(current.amount_minor) ||
        !current.currency ||
        !/^[A-Z]{3}$/.test(current.currency) ||
        typeof current.effective_at !== "string" ||
        !Number.isFinite(Date.parse(current.effective_at))))
  )
    throw Error("invalidValuation");
  return { version, current: row.exists ? current : null };
}
export function validValuationCommand(
  input: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  return (
    !!centerId &&
    input.center_id === centerId &&
    typeof input.discipline_id === "string" &&
    validate(input.discipline_id) &&
    (input.format === "group" || input.format === "private") &&
    slot === `valuation-${input.format}:${input.discipline_id}` &&
    Number.isSafeInteger(input.expected_version) &&
    Number(input.expected_version) > 0 &&
    money(input.amount_minor) &&
    typeof input.currency === "string" &&
    /^[A-Z]{3}$/.test(input.currency) &&
    typeof input.effective_at === "string" &&
    /(?:Z|[+-]\d\d:\d\d)$/.test(input.effective_at) &&
    Number.isFinite(Date.parse(input.effective_at))
  );
}
