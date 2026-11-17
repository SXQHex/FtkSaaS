import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { SettingsReviewDialog } from "./settings-review-dialog";
import {
  subscriptionRenewalIntent,
  writeSubscriptionRenewal,
  readSubscriptionRenewalReceipt,
  readSubscriptionRenewalResult,
  type SettingsSubscriptionSource,
} from "./settings-subscription";

export function SubscriptionRenewalEditor({
  before,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  before: SettingsSubscriptionSource;
  onSaved: (result: SettingsSubscriptionSource) => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string>();
  const busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeSubscriptionRenewal,
    readReceipt: readSubscriptionRenewalReceipt,
    readResult: readSubscriptionRenewalResult,
    onRefresh: onSaved,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const title = before.subscription.cancel_at_period_end
    ? t(($) => $.settings.subscriptionResumeRenewal)
    : t(($) => $.settings.subscriptionStopRenewal);
  async function confirm() {
    if (!accepted || busy.current || locked || command.state !== "ready") return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await subscriptionRenewalIntent(before);
      if (active.current) await command.start(intent);
    } catch (cause) {
      if (active.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.settings.subscriptionReadError),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  return (
    <SettingsReviewDialog
      open
      title={title}
      description={t(($) => $.settings.subscriptionRenewalHint)}
      rows={[{ id: "renewal", title, detail: t(($) => $.settings.subscriptionRenewalEffect) }]}
      accepted={accepted}
      onAccepted={setAccepted}
      locked={locked}
      blockers={error ? [{ id: "error", text: error }] : []}
      onClose={() => {
        if (!locked) onClose();
      }}
      onApply={
        !command.unavailable && command.state === "ready"
          ? () => {
              void confirm();
            }
          : undefined
      }
      recoveryActions={
        <EventCommandNotice command={command} onReload={() => window.location.reload()} />
      }
    />
  );
}
