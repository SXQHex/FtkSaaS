import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";
import { Dialog, DialogTitle } from "@ftksaas/ui/components/dialog";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import type { Permission, PersonView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import type { useMemberCommand } from "../member-profile/use-member-command";
import { confirmedStaffRemoval, readStaffRemovalPreview, type TeamIntent } from "./settings-team";
import { useTeamPermissionLabels } from "./team-permission-labels";

export function SettingsStaffRoleRemoval({
  scope,
  person,
  assignmentId,
  canWrite,
  command,
  onClose,
  onAccessLost,
}: {
  scope: ClientScope;
  person: PersonView;
  assignmentId: string;
  canWrite: boolean;
  command: ReturnType<typeof useMemberCommand<TeamIntent, unknown>>;
  onClose: () => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const labels: Partial<Record<Permission, string>> = useTeamPermissionLabels();
  const selectId = useId();
  const [selection, setSelection] = useState<{ previewId: string; recipientId: string }>();
  const [submittedPreview, setSubmittedPreview] =
    useState<Awaited<ReturnType<typeof readStaffRemovalPreview>>>();
  const readingPreview = !submittedPreview && command.state === "ready";
  const preview = useQuery({
    queryKey: ["settings-staff-role-removal", scope, person.id, assignmentId],
    queryFn: (context) => readStaffRemovalPreview(scope, person.id, assignmentId, context),
    enabled: canWrite && readingPreview,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const previewError = readingPreview ? preview.error : null;
  const previewReading = readingPreview && preview.isFetching;
  useEffect(() => {
    if (previewError) onAccessLost(previewError);
  }, [onAccessLost, previewError]);
  const current = submittedPreview ?? (readingPreview && !previewError ? preview.data : undefined);
  const impact = current?.staff_impact;
  const recipientId =
    selection?.previewId === current?.id
      ? selection?.recipientId
      : impact?.recipients[0]?.person_id;
  const followups =
    impact?.open_leads.reduce((total, lead) => total + lead.followups.length, 0) ?? 0;

  const retryPreview = !!previewError || command.state === "stale" || command.state === "rejected";
  const validRecipient =
    !impact?.handover_required ||
    impact.recipients.some((person) => person.person_id === recipientId);
  const canSubmit =
    !previewReading &&
    !command.busy &&
    !command.unavailable &&
    command.state !== "saved" &&
    (command.locked || (canWrite && (retryPreview || (!!current && validRecipient))));
  function submit() {
    if (!canSubmit) return;
    if (command.state === "unknown") void command.retry();
    else if (command.locked) void command.readReceipt();
    else if (retryPreview || (current && Date.parse(current.expires_at) <= Date.now())) {
      command.reset();
      if (submittedPreview) setSubmittedPreview(undefined);
      else void preview.refetch();
    } else if (current) {
      const intent = confirmedStaffRemoval(scope, current, recipientId);
      // The preview is valid for an active assignment. Once submitted, follow the write.
      setSubmittedPreview(current);
      void command.start(intent);
    }
  }

  return (
    <Dialog
      isOpen
      isDismissable={!command.locked}
      isKeyboardDismissDisabled={command.locked}
      onOpenChange={(open) => {
        if (!open && !command.locked) onClose();
      }}
      showCloseButton={false}
      className="team-removal-dialog"
    >
      <div className="team-card-header">
        <DialogTitle>{t(($) => $.settings.teamEditor.removalTitle)}</DialogTitle>
      </div>
      <div className="team-card-content grid gap-3">
        <p className="text-muted-foreground">
          {t(($) => $.settings.teamEditor.removalDescription, {
            person: person.display_name,
            role: t(($) => $.settings.teamNative.roles.staff),
          })}
        </p>
        {previewReading ? (
          <p role="status">{t(($) => $.settings.unread)}</p>
        ) : impact && current && !retryPreview ? (
          <>
            <div>
              <p className="team-effect-heading">
                {t(($) => $.settings.teamEditor.lostPermissions, {
                  count: impact.lost_permissions.length,
                })}
              </p>
              <ul className="team-effects">
                {impact.lost_permissions.map((permission) => (
                  <li key={permission}>{labels[permission] ?? permission}</li>
                ))}
                {!impact.lost_permissions.length && (
                  <li>{t(($) => $.settings.teamEditor.noLostPermissions)}</li>
                )}
              </ul>
            </div>
            <div>
              <p className="team-effect-heading">
                {t(($) => $.settings.teamEditor.openWork, {
                  count: impact.open_leads.length + followups,
                })}
              </p>
              <ul className="team-effects">
                {impact.open_leads.length ? (
                  <li>
                    {t(($) => $.settings.teamEditor.openCrmLeads, {
                      count: impact.open_leads.length,
                    })}
                  </li>
                ) : (
                  <li>{t(($) => $.settings.teamEditor.noOpenWork)}</li>
                )}
                {followups > 0 && (
                  <li>{t(($) => $.settings.teamEditor.openFollowups, { count: followups })}</li>
                )}
              </ul>
            </div>
            {impact.handover_required && (
              <Field>
                <FieldLabel htmlFor={selectId}>
                  {t(($) => $.settings.teamEditor.handover)}
                  <span aria-hidden="true" className="text-xs text-muted-foreground">
                    {t(($) => $.settings.teamEditor.handoverRequired)}
                  </span>
                </FieldLabel>
                <NativeSelect
                  id={selectId}
                  required
                  disabled={command.locked || !impact.recipients.length}
                  value={recipientId ?? ""}
                  onChange={(event) =>
                    setSelection({
                      previewId: current.id,
                      recipientId: event.currentTarget.value,
                    })
                  }
                >
                  {impact.recipients.map((recipient) => (
                    <NativeSelectOption key={recipient.person_id} value={recipient.person_id}>
                      {recipient.display_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {!impact.recipients.length && (
                  <p role="status">{t(($) => $.settings.teamEditor.noHandoverRecipient)}</p>
                )}
              </Field>
            )}
          </>
        ) : null}
        {(previewError || (command.state !== "ready" && command.state !== "saved")) && (
          <p role="status" className="text-muted-foreground">
            {t(($) =>
              previewError
                ? $.settings.teamEditor.staffPreviewError
                : $.events.commandStates[command.busy ? "writing" : command.state],
            )}
          </p>
        )}
      </div>
      <div className="team-card-footer">
        <Button autoFocus variant="outline" isDisabled={command.locked} onPress={onClose}>
          {t(($) => $.settings.discard)}
        </Button>
        <Button
          variant={retryPreview ? "default" : "destructive"}
          isDisabled={!canSubmit}
          onPress={submit}
        >
          {t(($) =>
            retryPreview ? $.settings.teamEditor.reloadPreview : $.settings.teamEditor.removeRole,
          )}
        </Button>
      </div>
    </Dialog>
  );
}
