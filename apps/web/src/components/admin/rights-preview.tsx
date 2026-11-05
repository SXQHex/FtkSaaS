"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { EntitlementView, NegativeLimitsView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import type { RightsApi } from "../../lib/rights";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, type useSetupCommand } from "../setup/setup-command";
import { RightsManagement } from "../products/rights-management";
export function RightsPreview({
  scope,
  personId,
  initial,
  disciplineId,
}: {
  scope: SetupScope;
  personId: string;
  initial: EntitlementView[];
  disciplineId: string;
}) {
  const t = useTranslations("rights"),
    [rows, setRows] = useState(initial),
    [limit, setLimit] = useState<NegativeLimitsView>({
      person_id: personId,
      center_id: scope.centerId!,
      discipline_id: disciplineId,
      version: 1,
      override: null,
      default_limit: 2,
      upper_limit: 5,
      effective_limit: 2,
      reserved_deficit: 1,
      consumed_deficit: 0,
      policy_version_ids: [],
      override_version: null,
    }),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    heading = useRef<HTMLHeadingElement>(null);
  const result = useCallback<RightsApi["preview"]>(
    async (_scope, change) => ({
      change,
      preserves_reservations: true,
      waives_independent_blocks: false,
      affected:
        change.kind === "credit_adjust" && change.direction === "decrease"
          ? [
              {
                reservation_id: disciplineId,
                session_id: disciplineId,
                person_id: personId,
                allocation_ids: [],
                deficit_ids: [],
                quantity: 2,
                source_sale_id: change.sale_id,
                existing_version: 1,
              },
            ]
          : [],
      preview: {
        id: v7(),
        token: "synthetic-design-proof",
        scope_hash: "synthetic",
        expires_at: new Date(Date.now() + 900000).toISOString(),
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        effects: [],
        blockers: [],
      },
    }),
    [disciplineId, personId],
  );
  const api: RightsApi = {
    preview: result,
    disciplines: async () => [{ id: disciplineId, name: "Salsa", version: 1, state: "active" }],
    limits: async () => limit,
    session: async () => ({
      id: disciplineId,
      class_id: null,
      discipline_id: disciplineId,
      format: "group",
      starts_at: "2026-11-10T15:00:00Z",
      ends_at: "2026-11-10T16:00:00Z",
      state: "planned",
      attendance_state: "open",
      assignments: [],
      version: 1,
      capacity: {
        total: 8,
        categories: null,
        held: 2,
        remaining: 6,
        category_held: null,
        category_remaining: null,
        room_capacity: 8,
      },
    }),
  };
  const command: ReturnType<typeof useSetupCommand> = {
    pending: null,
    busy,
    message: revision ? "saved" : "",
    check: async () => {
      throw Error("No pending design command");
    },
    run: async (command) => {
      if (!command) return;
      setBusy(true);
      if (command.operation === "credit_adjust_v1") {
        const input = command.input;
        setRows((old) =>
          old.map((row) =>
            row.sale_id === input.sale_id
              ? {
                  ...row,
                  available: Math.max(
                    0,
                    row.available +
                      (input.direction === "increase" ? input.quantity : -input.quantity),
                  ),
                  version: (row.version ?? 1) + 1,
                }
              : row,
          ),
        );
      } else if (command.operation === "entitlement_extend_v1") {
        const input = command.input;
        setRows((old) =>
          old.map((row) =>
            row.sale_id === input.sale_id
              ? { ...row, end_date: input.end_date, version: (row.version ?? 1) + 1 }
              : row,
          ),
        );
      } else if (command.operation === "negative_limit_set_v1") {
        const input = command.input;
        setLimit((old) => ({
          ...old,
          override: input.allowed_negative_credits,
          effective_limit: input.allowed_negative_credits,
          version: old.version + 1,
        }));
      } else throw Error("Unexpected design command");
      setRevision((n) => n + 1);
      setBusy(false);
    },
  };
  useEffect(() => {
    if (revision) heading.current?.focus();
  }, [revision]);
  return (
    <section className="min-w-0 space-y-4" aria-label={t("demoTitle")}>
      <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("demoTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("demoHint")}</p>
      <SetupFeedback command={command} />
      <RightsManagement
        key={revision}
        scope={scope}
        personId={personId}
        rows={rows}
        command={command}
        api={api}
      />
    </section>
  );
}
