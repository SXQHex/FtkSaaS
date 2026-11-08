import { setupCall, type SetupScope } from "./studio-setup";
import { getCenters, getOrganizations } from "./api";
export async function choicePages<T extends { id: string }>(
  read: (cursor?: string) => Promise<{ items: T[]; next_cursor?: string | null }>,
) {
  const result: T[] = [],
    seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const p = await read(cursor);
    result.push(...p.items);
    cursor = p.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw Error("invalidSettings");
    if (cursor) seen.add(cursor);
  } while (cursor);
  if (new Set(result.map((r) => r.id)).size !== result.length) throw Error("invalidSettings");
  return result;
}
export async function editorChoices(scope: SetupScope, target: string, name: string) {
  const organizations =
    target === "user"
      ? (await getOrganizations()).filter((o) => o.state === "active" && o.access_mode !== "closed")
      : [{ id: scope.orgId, name: "" }];
  const groups = await Promise.all(
    organizations.map(async (org) => {
      const [centers, disciplines] = await Promise.all([
        getCenters(org.id),
        choicePages((cursor) =>
          setupCall("disciplines_list_v1", {
            org_id: org.id,
            page: { limit: 200, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
          }),
        ),
      ]);
      const available = centers.filter((c) => c.accessible && c.state === "active");
      const products =
        name === "agreement_templates"
          ? await Promise.all(
              available.map((center) =>
                choicePages((cursor) =>
                  setupCall("products_list_v1", {
                    org_id: org.id,
                    center_id: center.id,
                    page: { limit: 200, ...(cursor ? { cursor } : {}) },
                  }),
                ),
              ),
            )
          : [];
      const people =
        name === "report_templates"
          ? await Promise.all(
              available.map((center) =>
                choicePages((cursor) =>
                  setupCall("people_list_v1", {
                    org_id: org.id,
                    center_id: center.id,
                    page: { limit: 200, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
                  }),
                ),
              ),
            )
          : [];
      return {
        centers: available.map((c) => ({ id: c.id, name: c.name, orgId: org.id })),
        disciplines: disciplines
          .filter((d) => d.state === "active")
          .map((d) => ({ id: d.id, name: d.name, orgId: org.id })),
        products: products.flat().map((p) => ({ id: p.id, name: p.terms.name, orgId: org.id })),
        people: people.flat().map((p) => ({ id: p.id, name: p.display_name, orgId: org.id })),
      };
    }),
  );
  const unique = <T extends { id: string }>(rows: T[]) => [
    ...new Map(rows.map((r) => [r.id, r])).values(),
  ];
  return {
    organizations: organizations.map((o) => ({ id: o.id, name: o.name })),
    centers: groups.flatMap((g) => g.centers),
    disciplines: groups.flatMap((g) => g.disciplines),
    products: unique(groups.flatMap((g) => g.products)),
    people: unique(groups.flatMap((g) => g.people)),
  };
}
