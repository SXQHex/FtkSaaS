import { validate } from "uuid";
import { setupCall, type SetupScope } from "./studio-setup";
import { validPayTerms } from "./agreement-command";
import { productDisciplines, listProducts } from "./products";
export const agreementApi = {
  list: async (scope: SetupScope, personId: string, cursor?: string) => {
    if (!scope.centerId) throw Error("invalidAgreement");
    const page = await setupCall("instructor_agreements_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const ids = new Set<string>();
    for (const row of page.items) {
      if (
        !validate(row.id) ||
        ids.has(row.id) ||
        row.person_id !== personId ||
        row.center_id !== scope.centerId ||
        !validate(row.discipline_id) ||
        !Number.isSafeInteger(row.version) ||
        row.version <= 0 ||
        !["group", "private"].includes(row.format) ||
        !Number.isFinite(Date.parse(row.valid.starts_at)) ||
        (row.valid.ends_at !== null &&
          !(Date.parse(row.valid.ends_at) > Date.parse(row.valid.starts_at))) ||
        !validPayTerms(row.terms)
      )
        throw Error("invalidAgreement");
      ids.add(row.id);
    }
    if (cursor && page.next_cursor === cursor) throw Error("invalidAgreement");
    return page;
  },
  disciplines: productDisciplines,
  products: listProducts,
};
export type AgreementApi = typeof agreementApi;
