"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { accountCall, accountError, freshAccountProof } from "../../lib/account";
import { CommandFeedback, useAccountCommand } from "./account-command";
import { ReauthFields } from "./session-manager";

export function AccountDelete({
  actorId,
  nativeUserId,
}: {
  actorId: string;
  nativeUserId: string;
}) {
  const t = useTranslations("account");
  const format = useFormatter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const command = useAccountCommand(actorId, "delete", () => setAccepted(true), nativeUserId);
  async function load() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    try {
      setPreview(await accountCall("account_delete_preview_v1", {}));
    } catch (cause) {
      setMessage(accountError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || command.busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      !command.pending &&
      (!preview || preview.blockers.length || Date.parse(preview.expires_at) <= Date.now())
    ) {
      setMessage("PREVIEW_STALE");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const proof = await freshAccountProof(
        actorId,
        String(data.get("password")),
        String(data.get("code")),
      );
      form.reset();
      await command.run(
        preview
          ? {
              operation: "account_delete_apply_v1",
              input: { operation_key: v7(), preview: { id: preview.id, token: preview.token } },
            }
          : undefined,
        proof,
      );
    } catch {
      setMessage("providerFailed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="delete-heading" className="space-y-5 border-t pt-8">
      <h2 id="delete-heading" className="text-xl font-semibold">
        {t("deleteAccount")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
      {message && <p role="alert">{t(message)}</p>}
      {accepted ? (
        <output className="block" aria-live="polite">
          {t("deletionAccepted")}
        </output>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy || command.busy || !!command.pending}
            onClick={() => void load()}
          >
            {t("previewDeletion")}
          </Button>
          {preview && (
            <div className="space-y-4 rounded-lg border p-4">
              <p>
                {t("previewExpires", {
                  time: format.dateTime(new Date(preview.expires_at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </p>
              {preview.blockers.length > 0 && (
                <ul role="alert" className="space-y-2">
                  {preview.blockers.map((blocker, i) => (
                    <li key={i}>
                      {t(
                        blocker.code === "OWNER_TRANSFER_REQUIRED"
                          ? "OWNER_TRANSFER_REQUIRED"
                          : "deletionBlocked",
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <ul className="space-y-2">
                {preview.effects.map((effect, i) => (
                  <li key={i}>
                    {t(`effects.${effect.action}`)}
                    {effect.quantity != null ? `: ${effect.quantity}` : ""}
                  </li>
                ))}
              </ul>
              {preview.lifecycle_impact && (
                <dl className="space-y-2 text-sm">
                  {(
                    [
                      "active_account_links",
                      "open_sessions",
                      "open_requests",
                      "active_reservations",
                      "active_event_registrations",
                      "open_debts",
                      "student_credit_accounts",
                    ] as const
                  ).map((key) => (
                    <div key={key} className="flex flex-wrap justify-between gap-3">
                      <dt>{t(`impact.${key}`)}</dt>
                      <dd>{preview.lifecycle_impact![key]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
          {(command.pending || (preview && !preview.blockers.length)) && (
            <form className="space-y-4" onSubmit={submit}>
              <ReauthFields disabled={busy || command.busy} />
              <div className="flex items-start gap-3">
                <Input
                  id="delete-confirm"
                  name="confirm"
                  type="checkbox"
                  required
                  className="mt-1 size-4 shrink-0"
                  disabled={busy || command.busy}
                />
                <Label htmlFor="delete-confirm" className="text-sm leading-6">
                  {t("deleteConfirmation")}
                </Label>
              </div>
              <Button
                variant="destructive"
                disabled={
                  busy ||
                  command.busy ||
                  command.pending === "invalid" ||
                  !!(command.pending && command.pending.blocked)
                }
              >
                {t("confirmDeletion")}
              </Button>
            </form>
          )}
        </>
      )}
      <CommandFeedback command={command} sensitive />
      <Link className="inline-block text-sm underline" href="/account/deletion">
        {t("deletionProgress")}
      </Link>
    </section>
  );
}
