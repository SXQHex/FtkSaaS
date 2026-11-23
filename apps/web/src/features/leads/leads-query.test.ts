import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateLeadPages } from "./leads-query";

it("invalidates the CRM report after lead changes in the same center", async () => {
  const scope = { accountId: "actor", orgId: "org", centerId: "center" };
  const crm = ["report-view", scope, "crm", "crm_conversion", undefined, {}, "cursor-2"];
  const sessions = ["report-view", scope, "sessions", "session_metrics"];
  const otherCenter = ["report-view", { ...scope, centerId: "elsewhere" }, "crm", "crm_conversion"];
  const queries = new QueryClient();
  for (const key of [crm, sessions, otherCenter]) queries.setQueryData(key, { revision: "before" });

  await invalidateLeadPages(queries, scope);

  expect(queries.getQueryState(crm)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(sessions)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(otherCenter)?.isInvalidated).toBe(false);
});
