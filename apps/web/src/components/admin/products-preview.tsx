"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProductView, EntitlementView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Preferences } from "../preferences";
import { RightsPreview } from "./rights-preview";
import { ProductCatalog } from "../products/product-manager";
import { PersonEntitlements } from "../products/person-entitlements";
import type { useSetupCommand } from "../setup/setup-command";
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: id, orgId: other, centerId: id };
const disciplines = async () => [{ id, name: "Salsa", state: "active" as const, version: 1 }];
const initial: ProductView[] = ["credits", "quota", "unlimited"].map((kind, i) => ({
  id: `019a2b3c-4d5e-7000-8000-00000000008${i + 2}`,
  version_id: `019a2b3c-4d5e-7000-8000-00000000009${i + 2}`,
  terms: {
    name: `Salsa ${kind}`,
    kind: kind === "credits" ? "credits" : "timed",
    credits: kind === "credits" ? 8 : null,
    booking_mode: "flexible",
    price_minor: "12345",
    currency: "TRY",
    freeze: { enabled: false, extends_validity: false },
    refund: { method: "none" },
    quota: kind === "quota" ? { period: "week", limit: 4 } : null,
    scopes: [
      {
        scope_kind: "center_discipline",
        center_id: id,
        discipline_id: id,
        usage_targets: ["lesson"],
      },
    ],
  },
}));
const initialRights: EntitlementView[] = initial.map((product, index) => ({
  sale_id: product.id,
  version: 1,
  sale_state: "active",
  person_id: other,
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  state: "active",
  available: product.terms.kind === "credits" ? 5 : 1,
  reserved: 2,
  consumed: 1,
  deficit: 0,
  kind: product.terms.kind,
  product_version_id: product.version_id,
  quotas:
    index === 1
      ? [
          {
            starts_at: "2026-11-01T00:00:00Z",
            ends_at: "2026-11-08T00:00:00Z",
            limit: 4,
            reserved: 2,
            consumed: 1,
          },
        ]
      : [],
  deficit_scopes: [],
}));
const rights = async () => initialRights;
export function ProductsPreview() {
  const t = useTranslations("products"),
    [items, setItems] = useState(initial),
    [revision, setRevision] = useState(0);
  const list = useCallback(
    async () => ({ items, next_cursor: null, as_of: "2026-11-05T00:00:00Z" }),
    [items],
  );
  const command: ReturnType<typeof useSetupCommand> = {
    pending: null,
    busy: false,
    message: revision ? "saved" : "",
    run: async (command) => {
      if (command?.operation !== "product_publish_v1") throw Error("Unexpected design command");
      const product: ProductView = {
        id: command.input.product_id ?? v7(),
        version_id: v7(),
        terms: command.input.terms,
      };
      setItems((old) => [...old.filter((row) => row.id !== product.id), product]);
      setRevision((n) => n + 1);
    },
    check: async () => {
      throw Error("No pending design command");
    },
  };
  return (
    <main
      id="main-content"
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-5 py-8 wrap-anywhere"
    >
      <Preferences />
      <h1 className="text-2xl font-semibold">{t("demoTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("demoHint")}</p>
      <ProductCatalog
        key={revision}
        scope={scope}
        command={command}
        list={list}
        disciplines={disciplines}
      />
      <PersonEntitlements scope={scope} personId={other} read={rights} />
      <RightsPreview scope={scope} personId={other} initial={initialRights} disciplineId={id} />
    </main>
  );
}
