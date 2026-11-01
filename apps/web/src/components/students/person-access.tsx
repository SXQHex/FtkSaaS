"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { ManagementStatePage, ManagementStateView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { Input } from "@ftksaas/ui/components/input";
import type { StudentScope } from "../../lib/students";
import { studentError } from "../../lib/students";
import { accessTarget, type AccessActions, type AccessOperation } from "../../lib/person-access";
import { useAccessCommand } from "./use-access-command";
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
type Props = {
  scope: StudentScope;
  personId: string;
  actions: AccessActions;
  revision: number;
  onSaved: () => void;
};
export function PersonAccess(props: Props) {
  return (
    <div className="space-y-6">
      <AccessList {...props} operation="account_access_revoke_v1" />
      <AccessList {...props} operation="account_link_remove_v1" />
    </div>
  );
}
function AccessList({
  scope,
  personId,
  actions,
  revision,
  onSaved,
  operation,
}: Props & { operation: AccessOperation }) {
  const t = useTranslations("students");
  const format = useFormatter();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [attempt, setAttempt] = useState(0);
  const cursor = cursors.at(-1);
  const [result, setResult] = useState<{
    attempt: number;
    revision: number;
    cursor?: string;
    data?: ManagementStatePage;
    error?: string;
  } | null>(null);
  const [selected, setSelected] = useState<ManagementStateView | null>(null);
  const [reason, setReason] = useState("");
  function refresh() {
    setSelected(null);
    setCursors([undefined]);
    setAttempt((a) => a + 1);
  }
  function saved() {
    refresh();
    onSaved();
  }
  const command = useAccessCommand(scope, personId, operation, actions, saved, refresh);
  const invitation = operation === "account_access_revoke_v1";
  useEffect(() => {
    let active = true;
    actions
      .list(scope, personId, operation, cursor)
      .then((data) => {
        if (active) setResult({ attempt, revision, cursor, data });
      })
      .catch((cause) => {
        if (active) setResult({ attempt, revision, cursor, error: studentError(cause) });
      });
    return () => {
      active = false;
    };
  }, [actions, scope, personId, operation, cursor, attempt, revision]);
  const current =
    result?.attempt === attempt && result.revision === revision && result.cursor === cursor
      ? result
      : null;
  const target =
    selected && current?.data?.items.includes(selected) ? accessTarget(selected, operation) : null;
  const pending = command.pending && command.pending !== "invalid" ? command.pending : null;
  function confirm() {
    if (
      !target?.actionable ||
      command.pending ||
      (operation === "account_link_remove_v1" && !reason.trim())
    )
      return;
    const common = {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      expected_version: target.version,
    };
    void command.save({
      command:
        operation === "account_access_revoke_v1"
          ? { operation, input: { ...common, invitation_id: target.id } }
          : { operation, input: { ...common, link_id: target.id, reason: reason.trim() } },
    });
  }
  return (
    <section
      className="min-w-0 space-y-3 border-t pt-6 wrap-anywhere"
      aria-label={t(invitation ? "accessInvitations" : "accessLinks")}
    >
      <h3 className="font-semibold">{t(invitation ? "accessInvitations" : "accessLinks")}</h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {t(invitation ? "accessInvitationsHint" : "accessLinksHint")}
      </p>
      <Button variant="outline" className={buttonClass} disabled={command.busy} onClick={refresh}>
        {t("refresh")}
      </Button>
      {!current && (
        <output className="block text-sm" aria-live="polite">
          {t("loadingDetail")}
        </output>
      )}
      {current?.error && (
        <p role="alert" className="text-sm">
          {t(t.has(`errors.${current.error}`) ? `errors.${current.error}` : "errors.unknown")}
        </p>
      )}
      {current?.data &&
        (current.data.items.length ? (
          <ul className="divide-y rounded-lg border px-4">
            {current.data.items.map((item, index) => {
              const record = accessTarget(item, operation);
              return (
                <li key={item.entity?.id ?? index} className="space-y-2 py-4 text-sm">
                  <p>
                    {t(
                      t.has(`accessStates.${item.state}`)
                        ? `accessStates.${item.state}`
                        : "accessStateUnknown",
                    )}
                  </p>
                  {record && (
                    <p className="text-xs text-muted-foreground">
                      {t("accessReference", { id: record.id })}
                    </p>
                  )}
                  {item.current?.operation === "account_access_revoke_v1" &&
                    item.current.values.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("accessExpires", {
                          date: format.dateTime(new Date(item.current.values.expires_at), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }),
                        })}
                      </p>
                    )}
                  {record?.actionable ? (
                    <Button
                      variant="outline"
                      className={buttonClass}
                      disabled={!!command.pending || command.busy}
                      onClick={() => {
                        setSelected(item);
                        setReason("");
                      }}
                    >
                      {t(invitation ? "revokeInvitation" : "removeAccountLink")}
                    </Button>
                  ) : (
                    <p className="text-muted-foreground">{t("accessNotActionable")}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(invitation ? "accessNoInvitations" : "accessNoLinks")}
          </p>
        ))}
      <nav
        className="flex flex-wrap gap-3"
        aria-label={t(invitation ? "accessInvitations" : "accessLinks")}
      >
        <Button
          variant="outline"
          className={buttonClass}
          disabled={cursors.length === 1 || command.busy}
          onClick={() => {
            setSelected(null);
            setCursors((c) => c.slice(0, -1));
          }}
        >
          {t("previous")}
        </Button>
        <Button
          variant="outline"
          className={buttonClass}
          disabled={!current?.data?.next_cursor || command.busy}
          onClick={() => {
            const next = current?.data?.next_cursor;
            if (next) {
              setSelected(null);
              setCursors((c) => [...c, next]);
            }
          }}
        >
          {t("next")}
        </Button>
      </nav>
      {target && !command.pending && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm leading-6">
            {t(invitation ? "revokeInvitationHint" : "removeAccountLinkHint")}
          </p>
          <p className="text-xs text-muted-foreground">{t("accessReference", { id: target.id })}</p>
          {!invitation && (
            <div className="space-y-2">
              <Label htmlFor="remove-account-link-reason">{t("removeAccountLinkReason")}</Label>
              <Input
                id="remove-account-link-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="destructive"
              className={buttonClass}
              disabled={command.busy || !target.actionable || (!invitation && !reason.trim())}
              onClick={confirm}
            >
              {t(invitation ? "confirmRevokeInvitation" : "confirmRemoveAccountLink")}
            </Button>
            <Button variant="outline" className={buttonClass} onClick={() => setSelected(null)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {pending && (
        <div className="space-y-3">
          <output className="block text-sm" aria-live="polite">
            {t("accessUncertain")}
          </output>
          <div className="flex flex-wrap gap-3">
            <Button
              className={buttonClass}
              disabled={command.busy}
              onClick={() => void command.check(pending)}
            >
              {t("check")}
            </Button>
            {command.replayReady && !pending.blocked && (
              <Button
                variant="outline"
                className={buttonClass}
                disabled={command.busy}
                onClick={() => void command.save(pending, true)}
              >
                {t("retrySame")}
              </Button>
            )}
          </div>
        </div>
      )}
      {(command.error || command.pending === "invalid") && (
        <p role="alert" className="text-sm leading-6">
          {command.pending === "invalid"
            ? t("storageInvalid")
            : t(t.has(`errors.${command.error}`) ? `errors.${command.error}` : "errors.unknown")}
        </p>
      )}
    </section>
  );
}
