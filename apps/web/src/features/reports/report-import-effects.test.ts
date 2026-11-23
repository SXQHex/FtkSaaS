import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateStudentImportViews } from "./report-import-effects";

it("refreshes warm projections of opening credit and debt for matched imported people", async () => {
  const scope = { accountId: "actor", orgId: "org", centerId: "center" };
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const otherCenter = { ...scope, centerId: "elsewhere" };
  const affected = [
    ["finance-directory", ...tenant, "debts", "cursor-2"],
    ["finance", ...tenant, "existing-person", "TRY"],
    ["profile-rights", ...tenant, "existing-person"],
    ["profile-person", ...tenant, "existing-person"],
    ["member-entitlements", ...tenant, "existing-person", "rights"],
    ["products-management", ...tenant, "all", "", "cursor-2"],
    ["product-history", ...tenant, "product", "sales", "cursor-2"],
    ["report-view", scope, "weeks", "sales", "week"],
    ["report-finance-summary", scope, {}],
  ];
  const unaffected = [
    ["product-history", ...tenant, "product", "versions", "cursor-2"],
    ["finance", scope.accountId, scope.orgId, otherCenter.centerId, "existing-person", "TRY"],
    ["report-view", scope, "balances", "instructor_balances"],
    ["report-finance-summary", otherCenter, {}],
  ];
  const queries = new QueryClient();
  for (const key of [...affected, ...unaffected]) queries.setQueryData(key, { revision: "before" });

  await invalidateStudentImportViews(queries, scope);

  for (const key of affected) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of unaffected) expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
});
