import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { platformAccessDenied } from "./platform-directory";

export function PlatformReadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const denied = platformAccessDenied(error);
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription className="space-y-2">
        <p>{t(($) => (denied ? $.platform.denied : $.platform.readError))}</p>
        {!denied && (
          <Button variant="outline" onPress={onRetry}>
            {t(($) => $.auth.retry)}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
