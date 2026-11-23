import type { ClientScope } from "../../lib/scoped-backend";

export const reportKeys = {
  views: (scope: ClientScope) => ["report-view", scope] as const,
  financeSummary: (scope: ClientScope) => ["report-finance-summary", scope] as const,
};

export function reportSessionMetricsFamily(scope: ClientScope) {
  return [...reportKeys.views(scope), "sessions", "session_metrics"] as const;
}

export function reportCollectionFamilies(scope: ClientScope) {
  return [
    reportKeys.financeSummary(scope),
    [...reportKeys.views(scope), "collections", "collection_breakdown"],
  ] as const;
}

export function reportSalesFamilies(scope: ClientScope) {
  return [
    [...reportKeys.views(scope), "weeks", "sales"],
    [...reportKeys.views(scope), "products", "sales"],
  ] as const;
}
