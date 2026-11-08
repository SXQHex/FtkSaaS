"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, type SetupScope, type SetupCommand } from "../../lib/studio-setup";
import { useRemote } from "../../lib/use-remote";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError } from "../bookings/flow-controls";
export function EmailPreferences({ scope }: { scope: SetupScope }) {
  return (
    <EmailConnection
      key={JSON.stringify([scope.actorId, scope.orgId])}
      scope={{ actorId: scope.actorId, orgId: scope.orgId }}
    />
  );
}
function EmailConnection({ scope: initialScope }: { scope: SetupScope }) {
  const [scope] = useState(initialScope),
    t = useTranslations("delivery"),
    [revision, setRevision] = useState(0),
    load = useCallback(
      () =>
        setupCall("notifications_list_v1", {
          org_id: scope.orgId,
          unread_only: false,
          page: { limit: 1 },
        }),
      [scope],
    ),
    state = useRemote(load, String(revision));
  return (
    <section className="space-y-4 rounded-md border p-4">
      <h3 className="font-semibold">{t("emailTitle")}</h3>
      <p>{t("emailHint")}</p>
      <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
        {t("refresh")}
      </Button>
      {state?.error && <FlowError code={state.error} />}
      {state?.data &&
        (["transactional", "reminder"] as const).map((purpose) => (
          <EmailField
            key={`${revision}:${purpose}`}
            scope={scope}
            purpose={purpose}
            value={
              purpose === "transactional"
                ? state.data!.email_preference
                : state.data!.reminder_email_preference
            }
            onSaved={() => setRevision((n) => n + 1)}
          />
        ))}
    </section>
  );
}
function EmailField({
  scope,
  purpose,
  value,
  onSaved,
}: {
  scope: SetupScope;
  purpose: "transactional" | "reminder";
  value?: { enabled: boolean; version: number; available: boolean };
  onSaved: () => void;
}) {
  const t = useTranslations("delivery"),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState("");
  const command = useSetupCommand(scope, `email:${purpose}`, onSaved, setError);
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">{t(purpose)}</h4>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      {!value || !value.available ? (
        <p>{t("unavailable")}</p>
      ) : (
        <>
          <p>{t(value.enabled ? "enabled" : "disabled")}</p>
          <Button
            variant="outline"
            disabled={command.busy || !!command.pending}
            onClick={() =>
              setReview({
                operation: "notification_preferences_set_v1",
                input: {
                  org_id: scope.orgId,
                  operation_key: v7(),
                  channel: "email",
                  purpose,
                  enabled: !value.enabled,
                  expected_version: value.version,
                },
              })
            }
          >
            {t(value.enabled ? "turnOff" : "turnOn")}
          </Button>
          {review && (
            <ConfirmWrite
              key={review.input.operation_key}
              command={review}
              controller={command}
              onBack={() => setReview(null)}
            >
              <p>
                {t(purpose)} · {t(value.enabled ? "disabled" : "enabled")}
              </p>
              <p>{t("emailHint")}</p>
            </ConfirmWrite>
          )}
        </>
      )}
    </div>
  );
}
