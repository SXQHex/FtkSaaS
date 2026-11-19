import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import { platformAccessDenied } from "./platform-directory";

export function PlatformActionReview<Intent, Result>({
  intent,
  title,
  description,
  rows,
  beforeWrite,
  write,
  read,
  onResult,
  onClose,
  onDenied,
}: {
  intent: Intent;
  title: string;
  description: string;
  rows: { id: string; title: string; detail: ReactNode }[];
  beforeWrite: (intent: Intent) => Promise<void>;
  write: (intent: Intent) => Promise<{ primary_id: string }>;
  read: (intent: Intent, id?: string) => Promise<Result>;
  onResult: (result: Result) => Promise<void>;
  onClose: () => void;
  onDenied: () => void;
}) {
  const { t } = useTranslation();
  const checking = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const command = useMemberCommand({
    write,
    readResult: read,
    onRefresh: onResult,
    onAccessLost: (error) => {
      if (!platformAccessDenied(error)) return false;
      onDenied();
      return true;
    },
  });
  async function apply() {
    if (checking.current || failed || command.state !== "ready" || !accepted) return;
    checking.current = true;
    setPreparing(true);
    try {
      await beforeWrite(intent);
      await command.start(intent);
    } catch (error) {
      if (platformAccessDenied(error)) onDenied();
      else setFailed(true);
    } finally {
      checking.current = false;
      setPreparing(false);
    }
  }
  return (
    <SettingsReviewDialog
      open
      title={title}
      description={description}
      rows={rows}
      accepted={accepted}
      onAccepted={setAccepted}
      locked={preparing || command.locked}
      onClose={onClose}
      onApply={!failed && command.state === "ready" ? () => void apply() : undefined}
      notice={failed ? t(($) => $.platform.billing.sourceChanged) : undefined}
      recoveryActions={
        failed ? (
          <Button variant="outline" onPress={onClose}>
            {t(($) => $.profile.loadCurrent)}
          </Button>
        ) : (
          <EventCommandNotice command={command} receiptAvailable={false} onReload={onClose} />
        )
      }
    />
  );
}
