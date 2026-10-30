"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { AccountSecurityHistory, AccountSessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { accountCall, freshAccountProof } from "../../lib/account";
import { CommandFeedback, useAccountCommand, type SessionPage } from "./account-command";

function SessionRow({
  item,
  actorId,
  onSaved,
}: {
  item: AccountSessionView;
  actorId: string;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const format = useFormatter();
  const command = useAccountCommand(actorId, `session:${item.session_id}`, onSaved);
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="space-y-4 border-b py-5 last:border-0 wrap-anywhere">
      <p className="font-medium">
        {item.label || t("unnamedSession")}{" "}
        {item.current && (
          <span className="text-sm text-muted-foreground">({t("currentSession")})</span>
        )}
      </p>
      <p className="text-sm text-muted-foreground">{item.user_agent ?? t("unknownDevice")}</p>
      <dl className="text-sm">
        <dt>{t("created")}</dt>
        <dd>
          {format.dateTime(new Date(item.created_at), { dateStyle: "medium", timeStyle: "short" })}
        </dd>
        <dt>{t("refreshed")}</dt>
        <dd>
          {format.dateTime(new Date(item.last_refreshed_at), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })}
        </dd>
      </dl>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const label = String(new FormData(event.currentTarget).get("label")).trim();
          void command.run({
            operation: "account_session_label_v1",
            input: {
              operation_key: v7(),
              session_id: item.session_id,
              expected_version: item.version,
              label: label || null,
            },
          });
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={`label-${item.session_id}`}>{t("sessionLabel")}</Label>
          <Input
            id={`label-${item.session_id}`}
            name="label"
            defaultValue={item.label ?? ""}
            maxLength={80}
            disabled={command.busy || !!command.pending}
          />
        </div>
        <Button variant="outline" disabled={command.busy || !!command.pending}>
          {t("saveLabel")}
        </Button>
      </form>
      <Button
        type="button"
        variant="outline"
        disabled={command.busy || !!command.pending}
        onClick={() => setConfirming(!confirming)}
      >
        {t("revokeSession")}
      </Button>
      {confirming && (
        <div className="space-y-3">
          <p>{t("revokeConfirm")}</p>
          <Button
            type="button"
            variant="destructive"
            disabled={command.busy || !!command.pending}
            onClick={() =>
              void command.run({
                operation: "account_sessions_revoke_v1",
                input: item.current
                  ? { operation_key: v7(), mode: "current" }
                  : { operation_key: v7(), mode: "selected", session_id: item.session_id },
              })
            }
          >
            {t("confirmRevoke")}
          </Button>
        </div>
      )}
      <CommandFeedback command={command} />
    </li>
  );
}
export function ReauthFields({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations("account");
  const id = useId();
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("reauthHint")}</p>
      <Label htmlFor={`${id}-password`}>{t("currentPassword")}</Label>
      <Input
        id={`${id}-password`}
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <Label htmlFor={`${id}-code`}>{t("totpCode")}</Label>
      <Input
        id={`${id}-code`}
        name="code"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
      />
    </fieldset>
  );
}
export function SessionManager({ actorId }: { actorId: string }) {
  const t = useTranslations("account");
  const format = useFormatter();
  const [sessions, setSessions] = useState<SessionPage | null>(null);
  const [history, setHistory] = useState<AccountSecurityHistory | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const command = useAccountCommand(actorId, "other-sessions", () => setRetry((n) => n + 1));
  useEffect(() => {
    let active = true;
    Promise.all([
      accountCall("account_sessions_list_v1", {}),
      accountCall("account_security_history_get_v1", {}),
    ])
      .then(([list, events]) => {
        if (active) {
          setSessions(list);
          setHistory(events);
          setError(false);
        }
      })
      .catch(() => {
        if (active) {
          setSessions(null);
          setHistory(null);
          setError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [actorId, retry]);
  async function more(kind: "sessions" | "history") {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === "sessions" && sessions?.next_cursor) {
        const next = await accountCall("account_sessions_list_v1", {
          cursor: sessions.next_cursor,
        });
        setSessions({ ...next, items: [...sessions.items, ...next.items] });
      }
      if (kind === "history" && history?.next_cursor) {
        const next = await accountCall("account_security_history_get_v1", {
          cursor: history.next_cursor,
        });
        setHistory({ ...next, items: [...history.items, ...next.items] });
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function revokeOthers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const proof = await freshAccountProof(
        actorId,
        String(data.get("password")),
        String(data.get("code")),
      );
      form.reset();
      await command.run(
        { operation: "account_sessions_revoke_v1", input: { operation_key: v7(), mode: "others" } },
        proof,
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="sessions-heading" className="space-y-5">
      <h2 id="sessions-heading" className="text-xl font-semibold">
        {t("sessions")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("sessionHint")}</p>
      {error && <p role="alert">{t("failed")}</p>}
      <Button variant="outline" type="button" onClick={() => setRetry((n) => n + 1)}>
        {t("refresh")}
      </Button>
      {!sessions && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {sessions && (
        <ul>
          {sessions.items.map((item) => (
            <SessionRow
              key={`${item.session_id}:${item.version}`}
              item={item}
              actorId={actorId}
              onSaved={() => setRetry((n) => n + 1)}
            />
          ))}
        </ul>
      )}
      {sessions?.next_cursor && (
        <Button variant="outline" disabled={busy} onClick={() => void more("sessions")}>
          {t("moreSessions")}
        </Button>
      )}
      <Button variant="outline" onClick={() => setConfirmOthers(!confirmOthers)}>
        {t("revokeOthers")}
      </Button>
      {confirmOthers && (
        <form className="space-y-4 rounded-lg border p-4" onSubmit={revokeOthers}>
          <ReauthFields disabled={busy || command.busy} />
          <Button
            disabled={
              busy ||
              command.busy ||
              command.pending === "invalid" ||
              !!(command.pending && command.pending.blocked)
            }
            variant="destructive"
          >
            {t("confirmRevokeOthers")}
          </Button>
        </form>
      )}
      <CommandFeedback command={command} sensitive />
      <h3 className="pt-5 text-lg font-semibold">{t("securityHistory")}</h3>
      {history?.items.length === 0 && <p>{t("noHistory")}</p>}
      <ul className="divide-y">
        {history?.items.map((event) => (
          <li key={event.id} className="space-y-1 py-4">
            <p>{t(`events.${event.action}`)}</p>
            <p className="text-sm text-muted-foreground">
              {format.dateTime(new Date(event.at), { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </li>
        ))}
      </ul>
      {history?.next_cursor && (
        <Button variant="outline" disabled={busy} onClick={() => void more("history")}>
          {t("moreHistory")}
        </Button>
      )}
    </section>
  );
}
