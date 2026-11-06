export function personPath(orgId: string, centerId: string, personId: string) {
  return `/organizasyon/${encodeURIComponent(orgId)}/merkez/${encodeURIComponent(centerId)}/kisi/${encodeURIComponent(personId)}`;
}
