import { capturedCallback } from "./callback";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { LinkButton } from "../../components/ui/button";

export function CallbackPage() {
  const { t } = useTranslation();
  const input = capturedCallback();
  const informational = !input.code && !input.providerError && input.next !== "/reset-password";
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-4 p-6">
      {informational && (
        <h1 className="text-2xl font-semibold">{t(($) => $.auth.callbackInfoTitle)}</h1>
      )}
      <Alert>
        <AlertDescription>
          {informational ? t(($) => $.auth.callbackInfo) : t(($) => $.auth.callbackError)}
        </AlertDescription>
      </Alert>
      {informational && <LinkButton href="/account">{t(($) => $.auth.account)}</LinkButton>}
      <LinkButton href="/login">{t(($) => $.auth.backLogin)}</LinkButton>
    </main>
  );
}
