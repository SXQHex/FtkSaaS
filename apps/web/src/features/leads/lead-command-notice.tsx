import { useTranslation } from "react-i18next";
import type { useMemberCommand } from "../member-profile/use-member-command";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
type Command = Pick<
  ReturnType<typeof useMemberCommand>,
  "state" | "busy" | "retry" | "readReceipt"
>;
export function LeadCommandNotice({
  command,
  onReload,
}: {
  command: Command;
  onReload?: () => void;
}) {
  const { t } = useTranslation();
  const message = {
    ready: "",
    writing: t(($) => $.leads.commandStates.writing),
    unknown: t(($) => $.leads.commandStates.unknown),
    pending: t(($) => $.leads.commandStates.pending),
    "saved-unread": t(($) => $.leads.commandStates["saved-unread"]),
    saved: t(($) => $.leads.commandStates.saved),
    stale: t(($) => $.leads.commandStates.stale),
    rejected: t(($) => $.leads.commandStates.rejected),
  }[command.state];
  if (command.state === "ready") return null;
  return (
    <Alert
      variant={
        command.state === "unknown" || command.state === "rejected" ? "destructive" : "default"
      }
    >
      <AlertDescription>
        <p role="status">{message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <Button
              variant="outline"
              size="sm"
              isDisabled={command.busy}
              onPress={() => void command.readReceipt()}
            >
              {t(($) => $.finance.readResult)}
            </Button>
          )}
          {command.state === "unknown" && (
            <Button
              variant="outline"
              size="sm"
              isDisabled={command.busy}
              onPress={() => void command.retry()}
            >
              {t(($) => $.studio.retrySameRequest)}
            </Button>
          )}
          {(command.state === "stale" || command.state === "rejected") && onReload && (
            <Button variant="outline" size="sm" isDisabled={command.busy} onPress={onReload}>
              {t(($) => $.profile.loadCurrent)}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
