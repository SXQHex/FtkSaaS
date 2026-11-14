import { useEffect, useRef, useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../auth/auth-layout";
import { deletionContext, readDeletionStatus, recoverDeletion } from "./deletion";
import { Button, LinkButton } from "../../components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "../../components/ui/empty";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

type Context = Awaited<ReturnType<typeof deletionContext>>;
export function DeletionPage() {
  const context = useLoaderData({ from: "/account_/deletion" });
  return <DeletionDetails key={context.actor ?? "anonymous"} context={context} />;
}
function DeletionDetails({ context }: { context: Context }) {
  const { t } = useTranslation();
  const [view, setView] = useState<Awaited<ReturnType<typeof readDeletionStatus>>>();
  const [pending, setPending] = useState(context.owned && !context.uncertain);
  const [failed, setFailed] = useState(false);
  const [uncertain, setUncertain] = useState(context.uncertain);
  const busy = useRef(false);
  const mounted = useRef(true);
  async function load(recover = false) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      if (recover) {
        await recoverDeletion();
        if (mounted.current) setUncertain(false);
      }
      const result = await readDeletionStatus();
      if (mounted.current) setView(result);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const timer =
      context.owned && !context.uncertain ? setTimeout(() => void load(), 0) : undefined;
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [context.owned, context.uncertain]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${t(($) => $.accountDeletion.resultTitle)} · Fethiye Tango`;
    return () => {
      document.title = previous;
    };
  }, [t]);
  return (
    <AuthLayout>
      <Empty className="items-start p-0 text-left">
        <EmptyHeader className="items-start gap-1">
          <EmptyTitle>
            <h1>
              {view?.complete
                ? t(($) => $.accountDeletion.completeTitle)
                : t(($) => $.accountDeletion.resultTitle)}
            </h1>
          </EmptyTitle>
          <EmptyDescription>{t(($) => $.accountDeletion.resultDescription)}</EmptyDescription>
        </EmptyHeader>
        {!context.owned && <p>{t(($) => $.accountDeletion.loginForStatus)}</p>}
        {pending && (
          <Skeleton className="h-16 w-full" aria-label={t(($) => $.accountDeletion.loading)} />
        )}
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.accountDeletion.statusFailed)}</AlertDescription>
          </Alert>
        )}
        {context.owned && uncertain && <p>{t(($) => $.accountDeletion.uncertain)}</p>}
        {view && (
          <div className="flex flex-col gap-3" role="status">
            <p>{t(($) => $.accountDeletion.jobStates[view.state])}</p>
            {view.privacy ? (
              <>
                <p>{t(($) => $.accountDeletion.privacyStates[view.privacy!.request_state])}</p>
                {view.privacy.pending_scopes.length > 0 && (
                  <div>
                    <p>{t(($) => $.accountDeletion.pendingScopes)}</p>
                    <ul className="list-inside list-disc">
                      {view.privacy.pending_scopes.map((scope) => (
                        <li key={scope}>{t(($) => $.accountDeletion.scopes[scope])}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {view.privacy.profile_erasure && (
                  <p>
                    {t(
                      ($) => $.accountDeletion.profileStates[view.privacy!.profile_erasure!.state],
                    )}
                  </p>
                )}
              </>
            ) : (
              <p>{t(($) => $.accountDeletion.noPrivacyProof)}</p>
            )}
            {!view.complete && <p>{t(($) => $.accountDeletion.physicalErasure)}</p>}
          </div>
        )}
        <EmptyContent className="flex-row flex-wrap justify-start gap-2">
          {context.owned && (
            <Button isDisabled={pending} onPress={() => void load(uncertain)}>
              {uncertain
                ? t(($) => $.accountDeletion.recover)
                : t(($) => $.accountDeletion.refreshStatus)}
            </Button>
          )}
          <LinkButton href="/login" variant={context.owned ? "outline" : "default"}>
            {t(($) => $.auth.backLogin)}
          </LinkButton>
          {failed && (
            <LinkButton href="/mfa" variant="outline">
              {t(($) => $.accountDeletion.openMfa)}
            </LinkButton>
          )}
        </EmptyContent>
      </Empty>
    </AuthLayout>
  );
}
