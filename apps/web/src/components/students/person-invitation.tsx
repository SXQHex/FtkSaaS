"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { PersonView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import {
  studentError,
  uncertainStudentChange,
  type StudentActions,
  type StudentScope,
} from "../../lib/students";
import type { AccountInvitationCommand } from "../../lib/api";

const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";
type InvitationCommand = AccountInvitationCommand;
type StoredInvitation =
  | { command: InvitationCommand; blocked?: boolean; resolved?: boolean }
  | { job_id: string; state: string }
  | "invalid"
  | null;

function invitationKey(scope: StudentScope, personId: string) {
  return `ftksaas:student-invitation:${scope.actorId}:${scope.orgId}:${scope.centerId}:${personId}`;
}
function recover(scope: StudentScope, personId: string): StoredInvitation {
  try {
    const value = JSON.parse(sessionStorage.getItem(invitationKey(scope, personId)) ?? "null");
    if (value === null) return null;
    if (
      typeof value.job_id === "string" &&
      /^[a-f0-9-]{36}$/i.test(value.job_id) &&
      typeof value.state === "string"
    )
      return { job_id: value.job_id, state: value.state };
    const command = value.command;
    const input = command?.input;
    if (
      command?.operation !== "account_access_send_v1" ||
      input?.org_id !== scope.orgId ||
      input?.center_id !== scope.centerId ||
      input?.person_id !== personId ||
      typeof input?.operation_key !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        input.operation_key,
      ) ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean") ||
      (value.resolved !== undefined && typeof value.resolved !== "boolean")
    )
      return "invalid";
    return {
      command: {
        operation: "account_access_send_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          person_id: personId,
          operation_key: input.operation_key,
        },
      },
      blocked: value.blocked,
      resolved: value.resolved,
    };
  } catch {
    return "invalid";
  }
}

export function PersonInvitation({
  scope,
  person,
  actions,
  onSaved,
}: {
  scope: StudentScope;
  person: PersonView;
  actions: StudentActions;
  onSaved?: () => void;
}) {
  const t = useTranslations("students");
  const [record, setRecord] = useState<StoredInvitation>(() => recover(scope, person.id));
  const [error, setError] = useState("");
  const [operationState, setOperationState] = useState("");
  const [loading, setLoading] = useState(false);
  const locked = useRef(false);
  const email = person.contacts?.find((contact) => contact.kind === "email")?.value;
  const key = invitationKey(scope, person.id);
  const write = (value: Exclude<StoredInvitation, "invalid" | null>) => {
    if (
      "command" in value &&
      record &&
      record !== "invalid" &&
      "command" in record &&
      record.command.input.operation_key === value.command.input.operation_key
    ) {
      value = {
        ...value,
        blocked: record.blocked || value.blocked,
        resolved: record.resolved || value.resolved,
      };
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      setRecord(value);
      return true;
    } catch {
      setRecord("invalid");
      setError("storageInvalid");
      return false;
    }
  };
  function clear() {
    try {
      sessionStorage.removeItem(key);
    } catch {
      setRecord("invalid");
      setError("storageInvalid");
      return false;
    }
    setRecord(null);
    return true;
  }
  async function send(command?: InvitationCommand, replay = false) {
    if (locked.current || expired) return;
    if (record && !replay && (!job || !terminal)) return;
    const value = command ?? {
      operation: "account_access_send_v1" as const,
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: person.id,
        operation_key: v7(),
      },
    };
    if (!write({ command: value })) return;
    locked.current = true;
    setLoading(true);
    setError("");
    setOperationState("");
    try {
      const job = await actions.invite(value.input);
      write({ job_id: job.job_id, state: job.state });
      onSaved?.();
    } catch (cause) {
      const code = studentError(cause);
      if (replay || uncertainStudentChange(cause)) {
        if (
          !write({
            command: value,
            blocked: ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code),
          })
        )
          return;
      } else if (!clear()) return;
      setError(code);
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }
  async function check(command: InvitationCommand) {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError("");
    setOperationState("");
    try {
      const status = await actions.operationResult(
        scope.orgId,
        command.operation,
        command.input.operation_key,
      );
      if (status.operation !== command.operation || status.key !== command.input.operation_key)
        throw new Error("Unexpected invitation status");
      if (status.status === "failed_final") {
        if (!clear()) return;
        setError("failedFinal");
      } else if (status.status === "result_expired") {
        if (!write({ command, blocked: true })) return;
        setError("result_expired");
      } else if (status.status === "succeeded") {
        if (!write({ command, resolved: true })) return;
        setError("");
      } else {
        if (!write({ command })) return;
        setError("");
        setOperationState(status.status);
      }
    } catch (cause) {
      setError(studentError(cause));
      write({ command });
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }
  async function refreshJob(jobId: string) {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await actions.jobStatus(scope.orgId, scope.centerId, jobId);
      if (result.id !== jobId) throw new Error("Unexpected job status");
      write({ job_id: result.id, state: result.state });
      onSaved?.();
      if (result.safe_error_code) setError(result.safe_error_code);
    } catch (cause) {
      setError(studentError(cause));
    } finally {
      locked.current = false;
      setLoading(false);
    }
  }
  const command = record && record !== "invalid" && "command" in record ? record.command : null;
  const expired =
    !!command && !!record && record !== "invalid" && "blocked" in record && record.blocked === true;
  const resolved =
    !!command &&
    !!record &&
    record !== "invalid" &&
    "resolved" in record &&
    record.resolved === true;
  const job = record && record !== "invalid" && "job_id" in record ? record : null;
  const terminal = job && ["failed", "cancelled"].includes(job.state);
  return (
    <section
      className="min-w-0 space-y-4 border-t pt-6 wrap-anywhere"
      aria-label={t("accountAccess")}
    >
      <h3 className="font-semibold">{t("accountAccess")}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{t("inviteHint")}</p>
      {record === "invalid" && (
        <p role="alert" className="text-sm leading-6">
          {t("storageInvalid")}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm leading-6">
          {t(t.has(`errors.${error}`) ? `errors.${error}` : "errors.unknown")}
        </p>
      )}
      {operationState && (
        <p className="text-sm leading-6 text-muted-foreground">
          {t("inviteOperationStates." + operationState)}
        </p>
      )}
      {!person.contacts && (
        <p className="text-sm leading-6 text-muted-foreground">{t("contactsNotShared")}</p>
      )}
      {person.contacts && !email && (
        <p className="text-sm leading-6 text-muted-foreground">{t("inviteNeedsEmail")}</p>
      )}
      {command && (
        <div className="space-y-3">
          <p className="text-sm leading-6">
            {t(resolved ? "inviteOperationSucceeded" : "inviteUncertain")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className={buttonClass} disabled={loading} onClick={() => void check(command)}>
              {t("check")}
            </Button>
            {!expired && (
              <Button
                className={buttonClass}
                variant="outline"
                disabled={loading}
                onClick={() => void send(command, true)}
              >
                {t(resolved ? "retrieveInviteJob" : "retrySame")}
              </Button>
            )}
          </div>
        </div>
      )}
      {job && (
        <div className="space-y-3">
          <p className="text-sm leading-6">{t(`inviteStates.${job.state}`)}</p>
          <Button
            variant="outline"
            className={buttonClass}
            disabled={loading}
            onClick={() => void refreshJob(job.job_id)}
          >
            {t("checkInviteJob")}
          </Button>
        </div>
      )}
      {email && !command && (!job || terminal) && record !== "invalid" && (
        <Button className={buttonClass} disabled={loading} onClick={() => void send()}>
          {t(job ? "retryInvite" : "sendInvite")}
        </Button>
      )}
    </section>
  );
}
