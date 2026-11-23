import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope, type AccountReadContext } from "../../lib/scoped-backend";
import { getTemporal } from "../../lib/temporal";
import { readProfileRights } from "../member-profile/profile-read";
export async function readOwnPackages(
  scope: ClientScope,
  personId: string,
  readContext?: AccountReadContext,
) {
  const rights = await readProfileRights(
      scope,
      personId,
      { includePurchaseSummary: true },
      readContext,
    ),
    T = await getTemporal();
  return rights.map((row) => {
    const purchase = row.purchase_summary;
    if (!purchase) throw Error("MEMBER_PURCHASE_UNAVAILABLE");
    z.string().trim().min(1).parse(purchase.product_name);
    if (row.kind === "credits")
      z.number().int().nonnegative().safe().parse(purchase.initial_credits);
    else if (purchase.initial_credits !== null) throw Error("MEMBER_PURCHASE_UNAVAILABLE");
    return {
      name: purchase.product_name,
      ...(row.kind === "credits" && purchase.initial_credits! > 0
        ? { usage: { consumed: row.consumed, total: purchase.initial_credits! } }
        : {}),
      id: row.sale_id,
      kind: row.kind,
      state: row.state,
      saleState: row.sale_state,
      counts: { available: row.available, reserved: row.reserved, consumed: row.consumed },
      deficit: row.deficit,
      validity: `${T.PlainDate.from(row.start_date).toLocaleString("tr-TR", { dateStyle: "medium" })} – ${T.PlainDate.from(row.end_date).toLocaleString("tr-TR", { dateStyle: "medium" })}`,
      quotas: row.quotas.map((quota) => ({
        startsAt: quota.starts_at,
        endsAt: quota.ends_at,
        limit: quota.limit,
        reserved: quota.reserved,
        consumed: quota.consumed,
      })),
      freezes:
        row.freezes
          ?.filter((freeze) => ["active", "scheduled"].includes(freeze.state))
          .map((freeze) => ({
            state: freeze.state,
            startsAt: freeze.starts_at,
            endsAt: freeze.planned_end,
          })) ?? [],
    };
  });
}
export async function readOwnDebt(
  scope: ClientScope,
  personId: string,
  readContext?: AccountReadContext,
) {
  z.uuid().parse(personId);
  const backend = await scopedBackend(scope, undefined, readContext);
  const person = await backend.call("person_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: personId,
    include_member_summary: true,
  });
  if (person.id !== personId || !person.member_summary) throw new Error("MEMBER_DEBT_UNAVAILABLE");
  const debt = person.member_summary.debt;
  if (debt.status === "available") {
    const currencies = new Set<string>();
    for (const item of debt.by_currency) {
      z.string()
        .regex(/^[A-Z]{3}$/)
        .parse(item.currency);
      z.string().regex(/^\d+$/).parse(item.remaining_minor);
      if (currencies.has(item.currency)) throw new Error("MEMBER_DEBT_UNAVAILABLE");
      currencies.add(item.currency);
    }
  }
  return debt;
}

export async function readOwnFinanceCurrencies(
  scope: ClientScope,
  personId: string,
  readContext?: AccountReadContext,
) {
  const backend = await scopedBackend(scope, undefined, readContext);
  const result = await backend.call("member_finance_currencies_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
  });
  if (result.person_id !== personId || new Set(result.currencies).size !== result.currencies.length)
    throw Error("MEMBER_FINANCE_CURRENCIES_UNAVAILABLE");
  z.iso.datetime({ offset: true }).parse(result.as_of);
  for (const currency of result.currencies)
    z.string()
      .regex(/^[A-Z]{3}$/)
      .parse(currency);
  return result.currencies;
}
