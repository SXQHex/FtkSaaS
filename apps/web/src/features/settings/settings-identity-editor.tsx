import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import {
  readSettingsIdentity,
  settingsIdentityIntent,
  writeSettingsIdentity,
  readSettingsIdentityReceipt,
  readSettingsIdentityResult,
} from "./settings-identity";
import type { SettingsLevel } from "./settings-document";
import { SettingsIdentitySheet } from "./settings-identity-sheet";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function SettingsIdentityEditor({
  scope,
  level,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  level: SettingsLevel;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState<string>(),
    [reviewing, setReviewing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [preparing, setPreparing] = useState(false);
  const executing = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const source = useQuery({
    queryKey: ["settings-identity", scope.accountId, scope.orgId, scope.centerId, level],
    queryFn: () => readSettingsIdentity(scope, level),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (source.error) onAccessLost(source.error);
  }, [source.error, onAccessLost]);
  const command = useMemberCommand({
    write: writeSettingsIdentity,
    readReceipt: readSettingsIdentityReceipt,
    readResult: readSettingsIdentityResult,
    onRefresh: async () => {
      await onSaved();
    },
    onAccessLost,
  });
  const locked = preparing || command.locked,
    available =
      !source.isError && !source.isFetching && source.isFetchedAfterMount ? source.data : undefined;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const value = name ?? available?.name ?? "",
    title = t(($) =>
      level === "organization" ? $.settings.fields["ay-ad"] : $.settings.fields["ay-sube"],
    );
  async function save() {
    if (executing.current || locked || !accepted || !available || command.state !== "ready") return;
    executing.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await settingsIdentityIntent(available, value);
      if (active.current) await command.start(intent);
    } catch (cause) {
      if (active.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.settings.identity.invalid),
        );
    } finally {
      executing.current = false;
      if (active.current) setPreparing(false);
    }
  }
  return (
    <SettingsIdentitySheet
      title={title}
      value={value}
      beforeName={available?.name}
      readable={!!available}
      ready={command.state === "ready"}
      locked={locked}
      reviewing={reviewing}
      accepted={accepted}
      onAccepted={setAccepted}
      onClose={onClose}
      onValue={(value) => {
        setName(value);
        setAccepted(false);
        setError(undefined);
      }}
      onReview={() => {
        setReviewing(true);
        setAccepted(false);
      }}
      onEdit={() => {
        setReviewing(false);
        setAccepted(false);
      }}
      onSave={() => {
        void save();
      }}
      notice={
        <>
          <EventCommandNotice
            command={command}
            onReload={() => {
              if (!locked) {
                command.reset();
                setReviewing(false);
                setAccepted(false);
                setName(undefined);
                void source.refetch();
              }
            }}
          />
          {(source.isError || error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {error ?? t(($) => $.settings.documentReadError)}{" "}
                {source.isError && (
                  <Button
                    variant="outline"
                    isDisabled={locked}
                    onPress={() => {
                      void source.refetch();
                    }}
                  >
                    {t(($) => $.auth.retry)}
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
