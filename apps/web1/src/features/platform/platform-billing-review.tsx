import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { platformAccessDenied, platformOrganizationsKey } from "./platform-directory";
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
  const checking = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const command = useMemberCommand({
    write: writePlatformBilling,
    readResult: readBillingResult,
    onAccessLost: (error) => {
      if (!platformAccessDenied(error)) return false;
      onDenied();
      return true;
    },
    onRefresh: async ({ data }) => {
      queries.setQueryData(sourceKey, data);
      await Promise.all([
        queries.invalidateQueries({ queryKey: platformPaymentsKey(intent.accountId) }),
        queries.invalidateQueries({ queryKey: platformOrganizationsKey(intent.accountId) }),
        queries.invalidateQueries({
          queryKey: ["platform-organization", intent.accountId, intent.orgId],
        }),
      ]);
    },
  });
  async function apply() {
    if (!accepted || checking.current || failed || command.state !== "ready") return;
    checking.current = true;
    setPreparing(true);
    try {
      await confirmBillingSource(intent);
      await command.start(intent);
    } catch (error) {
      if (platformAccessDenied(error)) onDenied();
      else setFailed(true);
    } finally {
      checking.current = false;
      setPreparing(false);
    }
  }
  const close = () => {
    if (preparing || command.locked) return;
    if (failed || ["stale", "rejected"].includes(command.state))
      void queries.invalidateQueries({ queryKey: sourceKey });
    onClose();
  };
  return (
    <SettingsReviewDialog
      open
      title={title}
      description={detail}
      rows={[{ id: "reason", title: t(($) => $.platform.reason), detail: intent.reason }]}
      accepted={accepted}
      onAccepted={setAccepted}
      locked={preparing || command.locked}
      onClose={close}
      onApply={!failed && command.state === "ready" ? () => void apply() : undefined}
      notice={failed ? t(($) => $.platform.billing.sourceChanged) : undefined}
      recoveryActions={
        failed ? (
          <Button variant="outline" onPress={close}>
            {t(($) => $.profile.loadCurrent)}
          </Button>
        ) : (
          <EventCommandNotice command={command} receiptAvailable={false} onReload={close} />
        )
      }
    />
  );
}
