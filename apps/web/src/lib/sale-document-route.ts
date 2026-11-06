export function saleDocumentPath(orgId: string, centerId: string, productVersionId: string) {
  return `/organizasyon/${encodeURIComponent(orgId)}/paket/${encodeURIComponent(productVersionId)}/belgeler?center=${encodeURIComponent(centerId)}`;
}
