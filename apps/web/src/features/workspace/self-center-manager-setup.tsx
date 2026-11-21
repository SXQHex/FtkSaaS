import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readWorkspace, workspaceRoles } from "./workspace";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@ftksaas/ui/components/card";

type SelfAssignIntent = {
  scope: ClientScope;
  key: string;
};

const common = (intent: SelfAssignIntent) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: intent.scope.orgId,
});

async function writeSelfAssign(intent: SelfAssignIntent) {
  return (await scopedBackend(intent.scope)).call("manager_self_assign_center_v1", {
    ...common(intent),
    operation_key: intent.key,
    target_center_id: intent.scope.centerId,
  });
}

async function readSelfAssignReceipt(intent: SelfAssignIntent) {
  const receipt = await (await scopedBackend(intent.scope)).call("operation_status_get_v1", {
    ...common(intent),
    operation: "manager_self_assign_center_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "manager_self_assign_center_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "role_assignments")
  )
    throw Error("SELF_MANAGER_RECEIPT_INVALID");
  return receipt;
}

async function readSelfAssignResult(intent: SelfAssignIntent, id?: string) {
  if (!id) throw Error("SELF_MANAGER_RESULT_UNAVAILABLE");
  const workspace = await readWorkspace(intent.scope.accountId, intent.scope.orgId);
  if (
    workspace.selected?.id !== intent.scope.orgId ||
    !workspaceRoles(workspace, intent.scope.centerId).includes("center_manager")
  )
    throw Error("SELF_MANAGER_RESULT_UNAVAILABLE");
  return workspace;
}

/** First-center onboarding only. Never broadens team/permission editor authorization. */
export function SelfCenterManagerSetup({
  scope,
  onLockChange,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
}) {
  const queries = useQueryClient();
  const router = useRouter();
  const command = useMemberCommand({
    write: writeSelfAssign,
    readReceipt: readSelfAssignReceipt,
    readResult: readSelfAssignResult,
    onRefresh: async (workspace) => {
      queries.setQueryData(["workspace", scope.accountId, scope.orgId], workspace);
      await queries.invalidateQueries({ queryKey: ["workspace", scope.accountId] });
    },
    onAccessLost: (error) => {
      const code =
        error instanceof BackendError ? error.code : error instanceof Error ? error.message : "";
      if (!["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code)) return false;
      void router.invalidate();
      return true;
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merkez yöneticiliğini etkinleştir</CardTitle>
        <CardDescription>
          Organizasyon sahibi olmak merkez yöneticiliğini otomatik olarak vermez.
          Salonları ve stüdyo kaynaklarını yönetmek için kendi hesabına bu merkezde
          yöneticilik ataması yap.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {command.state === "saved" ? (
          <p role="status">Merkez yöneticiliği doğrulandı. Stüdyo sayfasını açabilirsin.</p>
        ) : (
          <>
            {command.state === "ready" || command.state === "rejected" || command.state === "stale" ? (
              <Button
                isDisabled={command.locked || command.busy}
                onPress={() => {
                  command.reset();
                  void command.start({ scope, key: uuidv7() });
                }}
              >
                Kendimi merkez yöneticisi yap
              </Button>
            ) : null}
            {command.state === "unknown" || command.state === "pending" ? (
              <>
                <Button variant="outline" isDisabled={command.busy} onPress={() => void command.readReceipt()}>
                  İşlem durumunu oku
                </Button>
                <Button variant="outline" isDisabled={command.busy} onPress={() => void command.retry()}>
                  Aynı işlemi yeniden dene
                </Button>
              </>
            ) : null}
            {command.state === "saved-unread" ? (
              <Button variant="outline" isDisabled={command.busy} onPress={() => void command.readReceipt()}>
                Atama sonucunu yeniden oku
              </Button>
            ) : null}
            {command.state === "writing" ? <p role="status">Atama doğrulanıyor…</p> : null}
            {command.state === "rejected" || command.state === "stale" ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Atama tamamlanamadı. Hesap bağlantısını ve güncel merkez yetkisini kontrol et.
                </AlertDescription>
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
