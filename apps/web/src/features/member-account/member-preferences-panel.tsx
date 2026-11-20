import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { AccountPreferencesView, type PreferenceId } from "./member-account-view";
import {
  readMemberPreferences,
  writeMemberPreference,
  readMemberPreferenceReceipt,
  type PreferenceIntent,
} from "./member-preferences";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function MemberPreferencesPanel({
  scope,
  onLockChange,
  disabled = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient(),
    key = ["member-preferences", scope.accountId, scope.orgId, scope.centerId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => readMemberPreferences(scope),
    retry: false,
  });
  const command = useMemberCommand({
    write: writeMemberPreference,
    readReceipt: readMemberPreferenceReceipt,
    readResult: async (intent: PreferenceIntent) => {
      const next = await readMemberPreferences(intent.scope),
        row = next.rows.find((row) => row.id === intent.id);
      if (
        !row ||
        row.selected !== intent.enabled ||
        row.version === undefined ||
        row.version <= intent.version
      )
        throw new Error("PREFERENCE_RESULT_UNREAD");
      return next;
    },
    onRefresh: async (next) => {
      queries.setQueryData(key, next);
    },
    onAccessLost: (error) => {
      const lost =
        (error instanceof Error && ["ACCOUNT_CHANGED", "AUTH_REQUIRED"].includes(error.message)) ||
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code));
      if (lost) void router.invalidate();
      return lost;
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  function change(id: PreferenceId, enabled: boolean) {
    if (
      disabled ||
      command.locked ||
      command.state === "stale" ||
      query.isError ||
      id === "mandatory" ||
      id === "marketing"
    )
      return;
    const row = query.data?.rows.find((row) => row.id === id);
    if (!row?.writable || row.selected === undefined || row.version === undefined) return;
    command.reset();
    void command.start({ scope, id, enabled, version: row.version, key: uuidv7() });
  }
  return (
    <AccountPreferencesView
      rows={(
        ["email", "transactionalEmail", "inApp", "package", "marketing", "mandatory"] as const
      ).map((id) => {
        const row = query.data?.rows.find((row) => row.id === id);
        return {
          id,
          selected: row?.selected,
          disabled:
            disabled ||
            command.locked ||
            command.state === "stale" ||
            query.isError ||
            !row?.writable,
          onChange: (value) => change(id, value),
        };
      })}
      notice={
        <>
          {query.isPending && <p role="status">{t(($) => $.memberAccount.loading)}</p>}
          {query.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.memberAccount.preferencesReadFailed)}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={command.locked}
                  onPress={() => void query.refetch()}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {command.state !== "ready" && command.state !== "writing" && (
            <Alert
              variant={
                command.state === "unknown" || command.state === "rejected"
                  ? "destructive"
                  : "default"
              }
            >
              <AlertDescription>
                {t(
                  ($) =>
                    $.memberAccount.preferenceNotices[
                      command.state === "ready" || command.state === "writing"
                        ? "pending"
                        : command.state
                    ],
                )}
                {["unknown", "pending", "saved-unread"].includes(command.state) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      isDisabled={command.busy}
                      variant="outline"
                      size="sm"
                      onPress={() => void command.retry()}
                    >
                      {t(($) => $.auth.retry)}
                    </Button>
                    {command.state !== "saved-unread" && (
                      <Button
                        isDisabled={command.busy}
                        variant="outline"
                        size="sm"
                        onPress={() => void command.readReceipt()}
                      >
                        {t(($) => $.memberAccount.checkReceipt)}
                      </Button>
                    )}
                  </div>
                )}
                {command.state === "stale" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      void query.refetch().then((result) => {
                        if (!result.isError && result.data) command.reset();
                      });
                    }}
                  >
                    {t(($) => $.profile.loadCurrent)}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </>
      }
    />
  );
}
