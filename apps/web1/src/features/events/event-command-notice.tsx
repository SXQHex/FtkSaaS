import { useTranslation } from "react-i18next";
import type { useMemberCommand } from "../member-profile/use-member-command";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function EventCommandNotice({
  command,
  onReload,
}: {
  command: Pick<ReturnType<typeof useMemberCommand>, "state" | "busy" | "retry" | "readReceipt">;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  if (command.state === "ready") return null;
  return (
    <Alert
      variant={
        command.state === "rejected" || command.state === "unknown" ? "destructive" : "default"
      }
    >
      <AlertDescription>
        <p role="status">{t(($) => $.events.commandStates[command.state])}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <Button
              variant="outline"
              size="sm"
              isDisabled={command.busy}
              onPress={() => {
                void command.readReceipt();
              }}
            >
              {t(($) => $.finance.readResult)}
            </Button>
          )}
          {command.state === "unknown" && (
            <Button
              variant="outline"
              size="sm"
              isDisabled={command.busy}
              onPress={() => {
                void command.retry();
              }}
            >
              {t(($) => $.studio.retrySameRequest)}
            </Button>
          )}
          {["saved", "stale", "rejected"].includes(command.state) && (
            <Button variant="outline" size="sm" isDisabled={command.busy} onPress={onReload}>
              {t(($) => $.profile.loadCurrent)}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
