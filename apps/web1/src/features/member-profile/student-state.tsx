import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { readPerson } from "../people/people";
import { useMemberCommand } from "./use-member-command";
import { MemberStateDialog } from "./member-action-sheet";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
interface StudentStateIntent {
  scope: ClientScope;
  personId: string;
  operation: "student_activate_v1" | "student_deactivate_v1";
  reason: string;
  key: string;
}
async function writeStudentState(intent: StudentStateIntent) {
  const backend = await scopedBackend(intent.scope);
  const request = {
    client_api_version: 1 as const,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    center_id: intent.scope.centerId,
    person_id: intent.personId,
    operation_key: intent.key,
  };
  return intent.operation === "student_activate_v1"
    ? backend.call(intent.operation, request)
    : backend.call(intent.operation, { ...request, reason: intent.reason });
}
async function readStudentStateReceipt(intent: StudentStateIntent) {
  const backend = await scopedBackend(intent.scope);
  const receipt = await backend.call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: intent.operation,
    key: intent.key,
  });
  if (
    receipt.operation !== intent.operation ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "center_relationships")
  )
    throw new Error("STUDENT_STATE_RECEIPT_UNAVAILABLE");
  return receipt;
}
async function readStudentStateResult(intent: StudentStateIntent) {
  const person = await readPerson(intent.scope, intent.personId, {
    membershipDate: true,
    memberSummary: true,
  });
  const rows = person.relationships.filter(
    (row) => row.center_id === intent.scope.centerId && row.kind === "student",
  );
  if (
    intent.operation === "student_activate_v1"
      ? !rows.some((row) => row.state === "active")
      : !rows.some((row) => row.state === "inactive") || rows.some((row) => row.state === "active")
  )
    throw new Error("STUDENT_STATE_RESULT_UNAVAILABLE");
  return person;
}
export function StudentStateEditor({
  scope,
  personId,
  name,
  action,
  sourceAvailable,
  onClose,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  personId: string;
  name: string;
  action: "activate" | "deactivate";
  sourceAvailable: boolean;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: (person: Awaited<ReturnType<typeof readPerson>>) => Promise<void>;
}) {
  const { t } = useTranslation(),
    [reason, setReason] = useState(""),
    [invalid, setInvalid] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const command = useMemberCommand({
    write: writeStudentState,
    readReceipt: readStudentStateReceipt,
    readResult: readStudentStateResult,
    onRefresh,
    onAccessLost,
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  async function submit() {
    if (!sourceAvailable || locked || !["ready", "stale", "rejected"].includes(command.state))
      return;
    if (action === "deactivate" && !reason.trim()) {
      setInvalid(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const current = await readPerson(scope, personId);
      const active = current.relationships.some(
        (row) =>
          row.center_id === scope.centerId && row.kind === "student" && row.state === "active",
      );
      if (active === (action === "activate")) throw new Error("STUDENT_STATE_CHANGED");
      z.uuid().parse(personId);
      command.reset();
      await command.start({
        scope: { ...scope },
        personId,
        operation: action === "activate" ? "student_activate_v1" : "student_deactivate_v1",
        reason: reason.trim(),
        key: uuidv7(),
      });
    } catch (failure) {
      if (!onAccessLost(failure)) setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <MemberStateDialog
      action={action}
      name={name}
      reason={reason}
      pending={locked}
      readOnly={!sourceAvailable || command.unavailable}
      completed={command.state === "saved"}
      reasonError={invalid ? t(($) => $.memberProfile.lifecycle.required) : undefined}
      onReason={(value) => {
        setReason(value);
        setInvalid(false);
        setError(false);
        command.reset();
      }}
      onClose={() => {
        if (!locked) onClose();
      }}
      onConfirm={
        sourceAvailable && !command.unavailable && command.state !== "saved"
          ? () => {
              void submit();
            }
          : undefined
      }
      notice={
        <>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.memberProfile.lifecycle.sourceError)}</AlertDescription>
            </Alert>
          )}
          {command.state !== "ready" && (
            <p role="status">{t(($) => $.memberProfile.studentStates[command.state])}</p>
          )}
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.readReceipt();
              }}
            >
              {t(($) => $.finance.readResult)}
            </Button>
          )}
          {command.state === "unknown" && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.retry();
              }}
            >
              {t(($) => $.finance.retrySame)}
            </Button>
          )}
        </>
      }
    />
  );
}
