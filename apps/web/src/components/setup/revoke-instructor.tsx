"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { InstructorRevocationPreview, RoleView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand, errorKey } from "./setup-command";

export function RevokeInstructor({
  scope,
  role,
  onSaved,
}: {
  scope: SetupScope;
  role: RoleView;
  onSaved: () => void;
}) {
  const t = useTranslations("setup"),
    format = useFormatter();
  const command = useSetupCommand(scope, `revoke:${role.id}`, onSaved);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<InstructorRevocationPreview | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function inspect() {
    setPreview(null);
    setError("");
    setBusy(true);
    try {
      const result = await setupCall("role_revoke_preview_v1", {
        org_id: scope.orgId,
        center_id: scope.centerId!,
        assignment_id: role.id,
        expected_version: role.version,
      });
      if (result.assignment_id !== role.id || result.assignment_version !== role.version)
        throw new Error("Mismatched preview");
      if (alive.current) setPreview(result);
    } catch (cause) {
      if (alive.current) setError(errorKey(setupError(cause)));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const locked = busy || command.busy || !!command.pending;
  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" disabled={locked} onClick={() => setOpen(!open)}>
        {t("revokeRole")}
      </Button>
      {open && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("instructorRemovalHint")}</p>
          <Button type="button" variant="outline" disabled={locked} onClick={() => void inspect()}>
            {t("inspectRemoval")}
          </Button>
          {busy && <output aria-live="polite">{t("loading")}</output>}
          {error && <p role="alert">{t(error)}</p>}
          {preview && (
            <section className="space-y-4" aria-label={t("removalEffects")}>
              <h4 className="font-medium">{t("removalEffects")}</h4>
              {preview.sessions.length === 0 ? (
                <p>{t("noRemovalEffects")}</p>
              ) : (
                <ul className="divide-y">
                  {preview.sessions.map((session) => (
                    <li key={session.session_id} className="space-y-2 py-3 text-sm">
                      <p>
                        <time dateTime={session.starts_at}>
                          {format.dateTime(new Date(session.starts_at), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                        {" – "}
                        <time dateTime={session.ends_at}>
                          {format.dateTime(new Date(session.ends_at), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </p>
                      <p>
                        {t(
                          session.will_require_instructor
                            ? "instructorRequired"
                            : "instructorRemains",
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground">{t("removalPreservesSessions")}</p>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (locked) return;
                  if (Date.parse(preview.expires_at) <= Date.now()) {
                    setPreview(null);
                    setError("PREVIEW_STALE");
                    return;
                  }
                  const reason = String(new FormData(event.currentTarget).get("reason")).trim();
                  if (!reason) return;
                  void command
                    .run({
                      operation: "role_revoke_v1",
                      input: {
                        org_id: scope.orgId,
                        center_id: scope.centerId,
                        operation_key: v7(),
                        assignment_id: role.id,
                        expected_version: role.version,
                        reason,
                        impact_approval: { id: preview.id, token: preview.token },
                      },
                    })
                    .then(() => {
                      if (alive.current) setPreview(null);
                    });
                }}
              >
                <Label htmlFor={`reason-${role.id}`}>{t("reason")}</Label>
                <Input id={`reason-${role.id}`} name="reason" required disabled={locked} />
                <Button variant="destructive" disabled={locked}>
                  {t("confirmRevoke")}
                </Button>
              </form>
            </section>
          )}
        </div>
      )}
      <SetupFeedback command={command} />
    </div>
  );
}
