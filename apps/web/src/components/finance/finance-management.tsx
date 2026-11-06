"use client";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { FinanceView } from "@ftksaas/api-contracts";
import type { FinanceApi } from "../../lib/finance";
import type { SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { CollectionAccess } from "./collection-access";
import { CollectionCorrection } from "./collection-correction";
import { BalanceActions } from "./balance-actions";
import { SaleRefund } from "./sale-refund";
export function FinanceManagement({
  scope,
  view,
  timeZone,
  api,
  onSaved,
}: {
  scope: SetupScope;
  view: FinanceView;
  timeZone: string;
  api: FinanceApi;
  onSaved: () => void;
}) {
  const t = useTranslations("finance"),
    heading = useRef<HTMLHeadingElement>(null);
  const command = useSetupCommand(scope, `finance:${view.person_id}`, onSaved, onSaved);
  useEffect(() => {
    if (command.message) heading.current?.focus();
  }, [command.message]);
  return (
    <section className="min-w-0 space-y-5" aria-label={t("management")}>
      <h4 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("management")}
      </h4>
      <SetupFeedback command={command} />
      <CollectionAccess scope={scope} view={view} timeZone={timeZone} api={api} command={command} />
      <CollectionCorrection
        scope={scope}
        movements={view.movements.items}
        timeZone={timeZone}
        api={api.corrections}
        onSaved={onSaved}
      />
      <BalanceActions
        scope={scope}
        view={view}
        timeZone={timeZone}
        api={api.balance}
        onSaved={onSaved}
      />
      <SaleRefund
        scope={scope}
        personId={view.person_id}
        timeZone={timeZone}
        api={api.refunds}
        onSaved={onSaved}
      />
    </section>
  );
}
