import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import type { RequestManagerSelfAssignCenter } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { scopedBackend, scopedCommandBackend, type ClientScope } from "../../lib/scoped-backend";
import { capturePrivateReadback, invalidateCachedFamilies } from "../../lib/cache-invalidation";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { refreshWorkspace, workspaceKeys } from "../workspace/workspace-query";
import { SettingsReviewDialog } from "./settings-review-dialog";

type SelfAssignment = {
  scope: ClientScope;
  request: Omit<RequestManagerSelfAssignCenter, "request_id">;
};
const operation = "manager_self_assign_center_v1";

export function SettingsCenterAssignment({
  scope,
  centerLabel,
  canAssignSelf,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  centerLabel: string;
  canAssignSelf: boolean;
  locked: boolean;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [review, setReview] = useState<SelfAssignment>(),
    [accepted, setAccepted] = useState(false);
  const command = useMemberCommand({
    write: async (intent: SelfAssignment) => {
      const backend = await scopedCommandBackend(intent.scope);
      return backend.write((client) =>
        client.call(operation, { ...intent.request, request_id: uuidv7() }),
      );
    },
    readReceipt: async (intent) => {
      const backend = await scopedBackend(intent.scope);
      const receipt = await backend.call("operation_status_get_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: intent.scope.orgId,
        operation,
        key: intent.request.operation_key,
      });
      if (
        receipt.operation !== operation ||
        receipt.key !== intent.request.operation_key ||
        (receipt.result_reference && receipt.result_reference.type !== "role_assignments")
      )
        throw Error("TEAM_RECEIPT_INVALID");
      return receipt;
    },
    readResult: async (intent, id) => {
      if (!id) throw Error("TEAM_RESULT_UNAVAILABLE");
      const { accountId, orgId, centerId } = intent.scope;
      const assertCurrent = capturePrivateReadback(queries);
      await invalidateCachedFamilies(queries, [
        workspaceKeys.projection(accountId),
        workspaceKeys.projection(accountId, orgId),
      ]);
      assertCurrent();
      const result = await refreshWorkspace(queries, accountId, orgId);
      assertCurrent();
      if (
        result.selected?.id !== orgId ||
        !result.selected.self_management_scope?.managed_center_ids.includes(centerId) ||
        !result.centers.some((center) => center.id === centerId && center.accessible)
      )
        throw Error("TEAM_RESULT_UNAVAILABLE");
    },
    onRefresh: invalidateCenterDirectory,
    onAccessLost,
  });
  useEffect(() => {
    if (!command.locked) return;
    onLockChange(true);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  function invalidateCenterDirectory() {
    return invalidateCachedFamilies(queries, [["settings-team-directory", scope]]);
  }
  function closeReview() {
    if (command.locked) return;
    setReview(undefined);
    setAccepted(false);
    command.reset();
  }
  const selfAction = t(($) => $.settings.teamNative.assignSelf);
  return (
    <>
      {canAssignSelf && (
        <Button
          variant="outline"
          isDisabled={locked}
          onPress={() =>
            setReview({
              scope: { ...scope },
              request: {
                client_api_version: 1,
                org_id: scope.orgId,
                target_center_id: scope.centerId,
                operation_key: uuidv7(),
              },
            })
          }
        >
          {selfAction}
        </Button>
      )}
      {review && (
        <SettingsReviewDialog
          open
          title={selfAction}
          description={t(($) => $.settings.teamNative.review)}
          rows={[
            {
              id: "center",
              title: t(($) => $.settings.teamNative.targetCenter),
              detail: centerLabel,
            },
          ]}
          accepted={accepted}
          onAccepted={setAccepted}
          locked={command.locked}
          onClose={closeReview}
          onApply={
            canAssignSelf && command.state === "ready" && !command.unavailable
              ? () => {
                  if (accepted) void command.start(review);
                }
              : undefined
          }
          recoveryActions={<EventCommandNotice command={command} onReload={closeReview} />}
        />
      )}
    </>
  );
}
