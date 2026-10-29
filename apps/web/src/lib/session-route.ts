export function sessionPath(orgId: string, sessionId: string) {
  return `/organizasyon/${encodeURIComponent(orgId)}/seans/${encodeURIComponent(sessionId)}`;
}
