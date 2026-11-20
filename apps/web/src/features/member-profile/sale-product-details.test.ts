import { expect, it } from "vitest";
import { i18n } from "../../i18n";
import type { ProductView } from "@ftksaas/api-contracts";
import { saleProductConditions, saleProductDetail } from "./sale-product-details";
const product: ProductView = {
  id: "019a7b00-0000-7000-8000-000000000021",
  version_id: "019a7b00-0000-7000-8000-000000000022",
  terms: {
    name: "Sentetik",
    kind: "timed",
    booking_mode: "priority",
    price_minor: "9007199254740993",
    currency: "TRY",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "time_ratio" },
    quota: { period: "week", limit: 2 },
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: "019a7b00-0000-7000-8000-000000000004",
        discipline_id: "019a7b00-0000-7000-8000-000000000009",
        usage_targets: ["lesson"],
        class_id: "019a7b00-0000-7000-8000-000000000008",
      },
    ],
  },
};
it("keeps exact scope names, booking, quota and restrictions without broadening lessons to events", () => {
  const names = {
    centers: [{ id: product.terms.scopes[0].center_id!, name: "Sentetik merkez" }],
    disciplines: [{ id: product.terms.scopes[0].discipline_id!, name: "Sentetik disiplin" }],
  };
  const detail = saleProductDetail(product, names, i18n.t);
  for (const label of [
    "₺90.071.992.547.409,93",
    "Öncelikli",
    "2 · Haftalık kullanım sınırı",
    "Sentetik merkez",
    "Sentetik disiplin",
    "Belirli sınıfla sınırlı",
    "Grup ve özel dersler",
  ])
    expect(detail).toContain(label);
  expect(detail).not.toContain("Atölye ve etkinlik");
  expect(detail).not.toContain("Tüm disiplinler");
});
it("unknown restricted scope names remain restricted and organization scopes never become a selected center", () => {
  const unknown = saleProductConditions(product, { centers: [], disciplines: [] }, i18n.t);
  expect(unknown).toContain("Belirli merkez (adı alınamadı)");
  expect(unknown).toContain("Belirli disiplin (adı alınamadı)");
  expect(unknown).not.toContain("Tüm disiplinler");
  const org: ProductView = structuredClone(product);
  org.terms.scopes = [
    {
      scope_kind: "organization_all",
      center_id: null,
      discipline_id: null,
      usage_targets: ["event"],
      event_id: "019a7b00-0000-7000-8000-000000000023",
    },
  ];
  const detail = saleProductConditions(org, { centers: [], disciplines: [] }, i18n.t);
  expect(detail).toContain(
    "Kuruluş genelinde · Tüm disiplinler · Atölye ve etkinlik · Belirli etkinlikle sınırlı",
  );
  expect(detail).not.toContain("Grup ve özel dersler");
});
