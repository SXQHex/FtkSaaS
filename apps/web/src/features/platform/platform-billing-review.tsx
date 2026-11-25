import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  cacheVerifiedReadback,
  invalidateCachedFamilies,
  privateQueryRevision,
} from "../../lib/cache-invalidation";
import { workspaceKeys } from "../workspace/workspace-query";
import { usePlatformActivity } from "./platform-activity-context";
import { PlatformActionReview } from "./platform-action-review";
import { platformOrganizationsKey, readPlatformOrganization } from "./platform-directory";
import {
  confirmBillingSource,
  platformPaymentsKey,
  preparePaymentDecision,
  readBillingResult,
  writePlatformBilling,
  type BillingIntent,
} from "./platform-payment";

export function PlatformBillingReview({
  intent,
  title,
  detail,
  sourceKey,
  scopeRevision,
  onClose,
  onDenied,
}: {
  intent: BillingIntent;
  title: string;
  detail: string;
  sourceKey: readonly string[];
  scopeRevision?: number;
  onClose: () => void;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const { record } = usePlatformActivity();
  const payment = useRef<Awaited<ReturnType<typeof preparePaymentDecision>> | null>(null);
  function assertPaymentScope() {
    if (scopeRevision !== privateQueryRevision(queries)) throw new Error("ACCOUNT_CHANGED");
  }
  function paymentFor(key: string) {
    if (payment.current?.key !== key) throw new Error("ACCOUNT_CHANGED");
    return payment.current;
  }
  return (
    <PlatformActionReview
      intent={intent}
      title={title}
      description={detail}
      rows={[{ id: "reason", title: t(($) => $.platform.reason), detail: intent.reason }]}
      beforeWrite={async (decision) => {
        if (decision.kind === "grace") return confirmBillingSource(decision);
        assertPaymentScope();
        const prepared = await preparePaymentDecision(decision).catch((error: unknown) => {
          assertPaymentScope();
          throw error;
        });
        assertPaymentScope();
        payment.current = prepared;
      }}
      write={(decision) =>
        decision.kind === "payment"
          ? paymentFor(decision.key).write()
          : writePlatformBilling(decision)
      }
      read={(decision, id) =>
        decision.kind === "payment"
          ? paymentFor(decision.key).read(id)
          : readBillingResult(decision, id)
      }
      onResult={async ({ data }, assertCurrent) => {
        const { accountId, orgId } = intent;
        const detailKey = ["platform-organization", accountId, orgId];
        const organizations = platformOrganizationsKey(accountId);
        const payments = [
          [...platformPaymentsKey(accountId), orgId],
          [...platformPaymentsKey(accountId), undefined],
        ];
        await cacheVerifiedReadback(queries, sourceKey, data);
        assertCurrent();
        // Grace and the organization card share the same verified organization
        // projection. Its independent owner read is already present on the card.
        const current =
          queries.getQueryState<Awaited<ReturnType<typeof readPlatformOrganization>>>(detailKey);
        const retainOwner =
          current?.status === "success" &&
          !current.isInvalidated &&
          current.data &&
          data.organization &&
          current.fetchStatus === "idle";
        if (retainOwner && data.organization)
          await cacheVerifiedReadback(queries, detailKey, {
            ...current.data,
            organization: data.organization,
          });
        assertCurrent();
        const lists = intent.kind === "payment" ? [organizations, ...payments] : [organizations];
        await invalidateCachedFamilies(
          queries,
          [
            ...lists,
            ...(!retainOwner ? [detailKey] : []),
            ...(intent.kind === "payment" ? [["platform-grace", accountId, orgId]] : []),
            workspaceKeys.projection(accountId),
            workspaceKeys.projection(accountId, orgId),
            ["settings-subscription", accountId, orgId],
          ],
          lists,
        );
        assertCurrent();
        if (intent.kind === "grace" && !retainOwner)
          await queries.refetchQueries(
            { queryKey: detailKey, exact: true, type: "active" },
            { throwOnError: true },
          );
        assertCurrent();
        record({
          key: intent.key,
          kind:
            intent.kind === "grace"
              ? "graceExtended"
              : intent.accepted
                ? "paymentAccepted"
                : "paymentDeclined",
          subject: data.organization?.name,
        });
      }}
      onClose={onClose}
      onReload={() => {
        onClose();
        void queries.invalidateQueries({ queryKey: sourceKey, exact: true });
      }}
      onDenied={(error) => {
        if (
          intent.kind === "payment" &&
          error instanceof Error &&
          error.message === "ACCOUNT_CHANGED"
        )
          onClose();
        else onDenied();
      }}
    />
  );
}
