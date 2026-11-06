import type { PreparationSourceReference, ResolvedDomainPreparation } from "@ftksaas/api-contracts";
import { validate } from "uuid";
import { setupCall, type SetupScope } from "./studio-setup";
import { validPayTerms } from "./agreement-command";
export type PreparedAgreement = Extract<ResolvedDomainPreparation, { kind: "agreement" }>;
export function preparationKey(source: PreparationSourceReference) {
  return JSON.stringify([source.scope, source.center_id ?? null, source.key, source.version]);
}
function validSource(scope: SetupScope, source: PreparationSourceReference) {
  return (
    /^[A-Za-z0-9_-]{1,64}$/.test(source.key) &&
    Number.isSafeInteger(source.version) &&
    source.version >= 0 &&
    (source.scope === "organization"
      ? source.center_id === undefined
      : source.scope === "center" && source.center_id === scope.centerId)
  );
}
export const agreementPreparations = {
  list: async (scope: SetupScope) => {
    if (!scope.centerId) throw Error("invalidAgreement");
    const catalog = await setupCall("settings_catalog_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      scope: "center",
    });
    if (catalog.scope !== "center") throw Error("invalidAgreement");
    const rows = catalog.preparation_templates?.agreements ?? [];
    const keys = new Set<string>();
    for (const row of rows) {
      const key = preparationKey(row.source);
      if (
        !validSource(scope, row.source) ||
        keys.has(key) ||
        row.source.key !== row.template.key ||
        !row.template.name.trim() ||
        row.template.name.length > 100 ||
        !validate(row.template.discipline_id) ||
        !["group", "private"].includes(row.template.format) ||
        !validPayTerms(row.template.terms)
      )
        throw Error("invalidAgreement");
      keys.add(key);
    }
    return rows;
  },
  resolve: async (
    scope: SetupScope,
    source: PreparationSourceReference,
  ): Promise<PreparedAgreement> => {
    if (!scope.centerId || !validSource(scope, source)) throw Error("invalidAgreement");
    const result = await setupCall("settings_preparation_resolve_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      kind: "agreement",
      source,
    });
    if (
      result.kind !== "agreement" ||
      preparationKey(result.source) !== preparationKey(source) ||
      !validate(result.agreement_request.discipline_id) ||
      !["group", "private"].includes(result.agreement_request.format) ||
      !validPayTerms(result.agreement_request.terms)
    )
      throw Error("invalidAgreement");
    return result;
  },
};
