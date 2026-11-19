import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PlatformActionReview } from "./platform-action-review";
import { platformOrganizationsKey } from "./platform-directory";
import {
  confirmBillingSource,
  platformPaymentsKey,
  readBillingResult,
  writePlatformBilling,
  type BillingIntent,
} from "./platform-payment";

export function PlatformBillingReview({
  intent,
  title,
  detail,
  sourceKey,
  onClose,
  onDenied,
}: {
  intent: BillingIntent;
  title: string;
  detail: string;
  sourceKey: readonly string[];
  onClose: () => void;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  return (
    <PlatformActionReview
      intent={intent}
      title={title}
      description={detail}
      rows={[{ id: "reason", title: t(($) => $.platform.reason), detail: intent.reason }]}
      beforeWrite={confirmBillingSource}
      write={writePlatformBilling}
      read={readBillingResult}
      onResult={async ({ data }) => {
        queries.setQueryData(sourceKey, data);
        await Promise.all([
          queries.invalidateQueries({ queryKey: platformPaymentsKey(intent.accountId) }),
          queries.invalidateQueries({ queryKey: platformOrganizationsKey(intent.accountId) }),
          queries.invalidateQueries({
            queryKey: ["platform-organization", intent.accountId, intent.orgId],
          }),
        ]);
      }}
      onClose={() => {
        void queries.invalidateQueries({ queryKey: sourceKey });
        onClose();
      }}
      onDenied={onDenied}
    />
  );
}
