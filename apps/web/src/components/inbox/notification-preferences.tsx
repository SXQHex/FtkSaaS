"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import type { SetupScope } from "../../lib/studio-setup";
import { readNotificationPreferences } from "../../lib/notification-preferences";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
export function NotificationPreferences({
  scope,
  read = readNotificationPreferences,
}: {
  scope: SetupScope;
  read?: typeof readNotificationPreferences;
}) {
  return <PreferenceEditor key={`${scope.actorId}:${scope.orgId}`} scope={scope} read={read} />;
}
function PreferenceEditor({
  scope,
  read,
}: {
  scope: SetupScope;
  read: typeof readNotificationPreferences;
}) {
  const [revision, setRevision] = useState(0);
  const command = useSetupCommand(
    { actorId: scope.actorId, orgId: scope.orgId },
    "notification-preferences",
    () => setRevision((n) => n + 1),
  );
  return <NotificationPreferenceView key={revision} scope={scope} read={read} command={command} />;
}
export function NotificationPreferenceView({
  scope,
  read = readNotificationPreferences,
  command,
}: {
  scope: SetupScope;
  read?: typeof readNotificationPreferences;
  command: ReturnType<typeof useSetupCommand>;
}) {
  const t = useTranslations("inbox"),
    id = useId();
  const [page, setPage] = useState<Awaited<ReturnType<typeof read>> | null>(null);
  const [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [draft, setDraft] = useState(false),
    [confirm, setConfirm] = useState(false);
  const confirmButton = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    editButton = useRef<HTMLButtonElement>(null);
  function reload() {
    setPage(null);
    setConfirm(false);
    setError(false);
    setRetry((n) => n + 1);
  }
  useEffect(() => {
    if (command.message === "saved" || command.message === "failed") heading.current?.focus();
  }, [command.message]);
  useEffect(() => {
    let active = true;
    void read(scope)
      .then((result) => {
        if (active) {
          setPage(result);
          setDraft(result.enabled);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [scope, read, retry]);
  useEffect(() => {
    if (confirm) confirmButton.current?.focus();
  }, [confirm]);
  const disabled = command.busy || !!command.pending;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={t("preferencesTitle")}>
      <h2 ref={heading} tabIndex={-1} className="font-semibold outline-none">
        {t("preferencesTitle")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("mandatoryHint")}</p>
      <SetupFeedback command={command} />
      {error ? (
        <p role="alert">{t("preferencesError")}</p>
      ) : !page ? (
        <output>{t("loading")}</output>
      ) : (
        <>
          <p className="text-sm">{t(page.enabled ? "marketingEnabled" : "marketingDisabled")}</p>
          {!page.writable ? (
            <p className="text-sm text-muted-foreground">{t("preferencesUnavailable")}</p>
          ) : (
            <>
              <Label className="flex min-h-11 items-center gap-3" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  className="size-4 shrink-0"
                  checked={draft}
                  disabled={disabled}
                  onChange={(e) => {
                    setDraft(e.target.checked);
                    setConfirm(false);
                  }}
                />
                {t("marketingChoice")}
              </Label>
              {confirm ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm">
                    {t(draft ? "enableMarketingConfirm" : "disableMarketingConfirm")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      ref={confirmButton}
                      className="h-auto min-h-11 max-w-full whitespace-normal"
                      disabled={disabled}
                      onClick={() => {
                        setConfirm(false);
                        heading.current?.focus();
                        void command.run({
                          operation: "settings_update_v1",
                          input: {
                            scope: "member",
                            org_id: scope.orgId,
                            operation_key: v7(),
                            expected_version: page.version,
                            patch: { in_app_marketing: draft },
                          },
                        });
                      }}
                    >
                      {t("savePreferences")}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto min-h-11 max-w-full whitespace-normal"
                      disabled={disabled}
                      onClick={() => {
                        setConfirm(false);
                        requestAnimationFrame(() => editButton.current?.focus());
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  ref={editButton}
                  className="h-auto min-h-11 max-w-full whitespace-normal"
                  disabled={disabled || draft === page.enabled}
                  onClick={() => setConfirm(true)}
                >
                  {t("reviewPreferences")}
                </Button>
              )}
            </>
          )}
        </>
      )}
      <Button
        variant="outline"
        className="h-auto min-h-11 max-w-full whitespace-normal"
        disabled={command.busy}
        onClick={reload}
      >
        {t("reload")}
      </Button>
    </section>
  );
}
