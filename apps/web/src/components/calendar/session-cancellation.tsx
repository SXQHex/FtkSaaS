"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { Preview } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, errorKey, useSetupCommand } from "../setup/setup-command";
import { CancellationReview } from "./cancellation-review";
export function SessionCancellation({
  scope,
  sessionId,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  sessionId: string;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations("sessionLifecycle"),
    errors = useTranslations("setup");
  const [reason, setReason] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [finished, setFinished] = useState(false);
  const mounted = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useSetupCommand(scope, `cancel:${sessionId}`, () => {
    setPreview(null);
    setFinished(true);
    onSaved();
  });
  const disabled = loading || command.busy || !!command.pending;
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t("cancelHint")}</p>
      {error && <p role="alert">{errors(error)}</p>}
      {!preview && !command.pending && !finished && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (disabled || lock.current || !reason.trim()) return;
            lock.current = true;
            setLoading(true);
            setError("");
            try {
              const result = await setupCall("session_cancel_preview_v1", {
                org_id: scope.orgId,
                center_id: scope.centerId,
                session_id: sessionId,
                reason: reason.trim(),
              });
              if (mounted.current) setPreview(result);
            } catch (cause) {
              if (mounted.current) setError(errorKey(setupError(cause)));
            } finally {
              lock.current = false;
              if (mounted.current) setLoading(false);
            }
          }}
        >
          <label className="block space-y-2 text-sm">
            <span>{t("reason")}</span>
            <textarea
              required
              rows={3}
              disabled={disabled}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border bg-background p-3"
            />
          </label>
          <Button type="submit" variant="outline" disabled={disabled}>
            {t("preview")}
          </Button>
        </form>
      )}
      {preview && !command.pending && (
        <CancellationReview
          key={preview.id}
          preview={preview}
          timeZone={timeZone}
          disabled={disabled}
          onBack={() => {
            setPreview(null);
            setError("");
          }}
          onApply={() =>
            void command.run({
              operation: "session_cancel_apply_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                preview: { id: preview.id, token: preview.token },
              },
            })
          }
        />
      )}
      <SetupFeedback command={command} />
    </div>
  );
}
