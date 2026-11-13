import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { LinkButton } from "../../components/ui/button";

export function CallbackPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-6">
      <Alert>
        <AlertDescription>{t(($) => $.auth.callbackError)}</AlertDescription>
      </Alert>
      <LinkButton href="/login">{t(($) => $.auth.backLogin)}</LinkButton>
    </main>
  );
}
