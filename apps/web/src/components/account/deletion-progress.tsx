"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { JobStatusView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { browserClient } from "../../lib/supabase/client";
import { AccountDelete } from "./account-delete";
import { recoverAccountCommand } from "./account-command";
import { accountCall, accountError } from "../../lib/account";

export function DeletionProgress({ nativeUserId }: { nativeUserId: string }) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<JobStatusView | null>(null);
  const [recoveryActor, setRecoveryActor] = useState<string | null>(null);
  const [accessible, setAccessible] = useState(true);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== nativeUserId)) {
        alive.current = false;
        setAccessible(false);
        setJob(null);
        setRecoveryActor(null);
        setMessage("AUTH_REQUIRED");
      }
    });
    return () => {
      alive.current = false;
      data.subscription.unsubscribe();
    };
  }, [nativeUserId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !accessible || !alive.current) return;
    const value = String(new FormData(event.currentTarget).get("job")).trim();
    setBusy(true);
    setMessage("");
    setJob(null);
    try {
      const stored = sessionStorage.getItem(`ftksaas:account-deletion-job:${nativeUserId}`);
      const jobId = value || stored;
      if (
        !jobId ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(jobId)
      ) {
        setMessage("missingDeletionJob");
        return;
      }
      const result = await accountCall("job_status_get_v1", { org_id: null, job_id: jobId });
      if (!alive.current) return;
      setJob(result);
      setMessage(result.state === "succeeded" ? "deletionJobSucceeded" : "deletionJobPending");
    } catch (cause) {
      if (alive.current) setMessage(accountError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh max-w-xl space-y-6 px-5 py-8 outline-none"
    >
      <Link href="/account" className="underline">
        {t("title")}
      </Link>
      <h1 className="text-3xl font-semibold">{t("deletionProgress")}</h1>
      <p>{t("deletionProgressHint")}</p>
      <form onSubmit={submit} className="space-y-4">
        <Label htmlFor="deletion-job">{t("deletionReference")}</Label>
        <Input id="deletion-job" name="job" disabled={busy || !accessible} />
        <Button disabled={busy || !accessible}>{t("checkResult")}</Button>
      </form>
      {accessible && (
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              try {
                const actor = sessionStorage.getItem(
                  `ftksaas:account-deletion-recovery:${nativeUserId}`,
                );
                if (!actor) {
                  setMessage("noPendingDeletion");
                  return;
                }
                if (
                  !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
                    actor,
                  )
                ) {
                  setMessage("storageFailed");
                  return;
                }
                const pending = recoverAccountCommand(actor, "delete");
                if (pending === "invalid") {
                  setMessage("storageFailed");
                  return;
                }
                if (!pending || pending.command.operation !== "account_delete_apply_v1") {
                  setMessage("noPendingDeletion");
                  return;
                }
                setRecoveryActor(actor);
                setMessage("");
              } catch {
                setMessage("storageFailed");
              }
            }}
          >
            {t("findPendingDeletion")}
          </Button>
          {recoveryActor && (
            <AccountDelete
              key={recoveryActor}
              actorId={recoveryActor}
              nativeUserId={nativeUserId}
              recoveryOnly
            />
          )}
        </div>
      )}
      {job && (
        <section aria-label={t("deletionProgress")} className="space-y-3 border-t pt-5">
          <p>
            {t("jobState")}: {t(`jobStates.${job.state}`)}
          </p>
          <p>{t("progressCount", { done: job.progress_count, total: job.total_count ?? "—" })}</p>
          {job.privacy && (
            <div className="space-y-3">
              <p>
                {t("privacyState")}: {t(`privacyStates.${job.privacy.request_state}`)}
              </p>
              {job.privacy.pending_scopes.length > 0 && (
                <div>
                  <p>{t("pendingScopes")}</p>
                  <ul>
                    {job.privacy.pending_scopes.map((scope) => (
                      <li key={scope}>{t(`privacyScopes.${scope}`)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {message && (
        <output className="block" aria-live="polite">
          {t(message)}
        </output>
      )}
    </main>
  );
}
