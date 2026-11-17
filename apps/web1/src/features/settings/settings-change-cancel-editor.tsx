import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { Button } from "../../components/ui/button";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import { SettingsReviewDialog } from "./settings-review-dialog";
import type { SettingsSubscriptionSource } from "./settings-subscription";
import {
  readSettingsCancelSource,
  settingsCancelIntent,
  writeSettingsCancel,
  readSettingsCancelReceipt,
  readSettingsCancelResult,
} from "./settings-change-cancel";

export function SettingsChangeCancelEditor({
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
  const source = useQuery({
    queryKey: [
      "settings-change-cancel",
      before.scope.accountId,
      before.scope.orgId,
      before.subscription.pending_change?.id,
      before.subscription.billing?.pending_period_change?.id,
    ],
    queryFn: () => readSettingsCancelSource(before),
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (source.error) onAccessLost(source.error);
  }, [source.error, onAccessLost]);
  const command = useMemberCommand({
    write: writeSettingsCancel,
    readReceipt: readSettingsCancelReceipt,
    readResult: readSettingsCancelResult,
    onRefresh: onSaved,
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const current =
    !source.isError && !source.isFetching && source.isFetchedAfterMount && !command.unavailable
      ? source.data
      : undefined;
  async function confirm() {
    if (!current || !accepted || busy.current || locked || command.state !== "ready") return;
    busy.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await settingsCancelIntent(current);
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
      title={t(($) => $.settings.cancelChangeTitle)}
      description={t(($) => $.settings.cancelChangeHint)}
      rows={
        current
          ? [
              {
                id: "change",
                title: t(($) => $.settings.cancelChangeTitle),
                detail: t(($) => $.settings.cancelChangeVersion, { version: current.version }),
              },
            ]
          : null
      }
      accepted={accepted}
      onAccepted={setAccepted}
      locked={locked}
      blockers={
        error || source.isError
          ? [{ id: "error", text: error ?? t(($) => $.settings.subscriptionReadError) }]
          : []
      }
      onApply={
        current && !command.unavailable && command.state === "ready"
          ? () => {
              void confirm();
            }
          : undefined
      }
      onClose={() => {
        if (!locked) onClose();
      }}
      recoveryActions={
        <>
          {(error || source.isError) && !locked && (
            <Button type="button" variant="outline" onPress={() => window.location.reload()}>
              {t(($) => $.settings.subscriptionReload)}
            </Button>
          )}
          <EventCommandNotice command={command} onReload={() => window.location.reload()} />
        </>
      }
    />
  );
}
