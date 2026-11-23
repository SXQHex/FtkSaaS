import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { JobRef, JobStatusView } from "@ftksaas/api-contracts";
import { readPersonInvitationJob } from "../people/people";
import { Button } from "@ftksaas/ui/components/button";
import { AccessActionDialog } from "./access-action";
import type { AccessAction } from "./access-view";
import {
  readAccessAction,
  accessWriteIntent,
  writeAccessAction,
  type AccessActionBase,
  type AccessWriteIntent,
} from "./access";

type Notice =
  | "reading"
  | "ready"
  | "unavailable"
  | "read-error"
  | "unknown"
  | "stale"
  | "rejected"
  | "saved-unread"
  | "saved";
interface Props {
  scope: ClientScope;
  selection: AccessAction;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  // The page must clear its private selection/cache before leaving an unavailable
  // account/scope. A completed self-unlink must not trap the old private page.
  onAccessLost: () => void;
}
export function AccessActionController(props: Props) {
  const row =
    "invitation" in props.selection ? props.selection.invitation : props.selection.account;
  const target = "linkId" in row ? row.linkId : row.id;
  return (
    <AccessActionForm
      key={`${props.scope.accountId}:${props.scope.orgId}:${props.scope.centerId}:${props.selection.kind}:${row.personId}:${target ?? ""}`}
      {...props}
    />
  );
}
function AccessActionForm({
  scope,
  selection,
  onClose,
  onLockChange,
  onRefresh,
  onAccessLost,
}: Props) {
  const { t } = useTranslation();
  // The keyed action retains its original selection through parent refreshes.
  const [initialSource] = useState(() => ({ scope, selection }));
  const [base, setBase] = useState<AccessActionBase>();
  const [notice, setNotice] = useState<Notice>("reading");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [reading, setReading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [hasAcknowledgement, setHasAcknowledgement] = useState(false);
  const [isTerminal, setIsTerminal] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatusView>();
  const intent = useRef<AccessWriteIntent | undefined>(undefined);
  const acknowledged = useRef(false);
  const job = useRef<JobRef | undefined>(undefined);
  const lock = useRef(false);
  const mounted = useRef(true);
  const terminal = useRef(false);
  const preventClose =
    !isTerminal && (writing || notice === "unknown" || notice === "saved-unread");
  useEffect(() => {
    onLockChange(preventClose);
    return () => onLockChange(false);
  }, [preventClose, onLockChange]);
  useBlocker({
    shouldBlockFn: () =>
      !terminal.current && (lock.current || notice === "unknown" || notice === "saved-unread"),
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });
  useEffect(() => {
    if (reading || writing) return;
    if (reasonError) document.getElementById("access-action-reason")?.focus();
    else if (notice !== "ready") document.getElementById("access-action-notice")?.focus();
  }, [reading, writing, reasonError, notice]);
  const accessLost = useCallback(
    (error: unknown, afterAcknowledgement = false) => {
      const code =
        error instanceof BackendError
          ? error.code
          : error instanceof Error
            ? error.message
            : undefined;
      if (
        code &&
        (["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code) ||
          (afterAcknowledgement && ["FORBIDDEN", "NOT_FOUND"].includes(code)))
      ) {
        terminal.current = true;
        setIsTerminal(true);
        setBase(undefined);
        setJobStatus(undefined);
        setNotice("rejected");
        onAccessLost();
        return true;
      }
      return false;
    },
    [onAccessLost],
  );
  async function load() {
    if (lock.current || acknowledged.current || intent.current) return;
    lock.current = true;
    setReading(true);
    setNotice("reading");
    setBase(undefined);
    setReason("");
    setReasonError(undefined);
    intent.current = undefined;
    try {
      const current = await readAccessAction(scope, selection);
      if (!mounted.current) return;
      setBase(current);
      setNotice(current.actionable ? "ready" : "unavailable");
    } catch (error) {
      if (mounted.current && !accessLost(error)) setNotice("read-error");
    } finally {
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  const initialAccessLost = useEffectEvent(accessLost);
  useEffect(() => {
    const controller = new AbortController();
    mounted.current = true;
    lock.current = true;
    async function initialRead() {
      try {
        const current = await readAccessAction(
          initialSource.scope,
          initialSource.selection,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setBase(current);
        setNotice(current.actionable ? "ready" : "unavailable");
      } catch (error) {
        if (!controller.signal.aborted && !initialAccessLost(error)) setNotice("read-error");
      } finally {
        if (!controller.signal.aborted) {
          lock.current = false;
          setReading(false);
        }
      }
    }
    void initialRead();
    return () => {
      controller.abort();
      mounted.current = false;
    };
  }, [initialSource]);
  async function reread() {
    const currentIntent = intent.current;
    if (!acknowledged.current || !currentIntent) throw new Error("ACCESS_ACK_UNAVAILABLE");
    if (currentIntent.kind === "invite") {
      const currentJob = job.current;
      if (!currentJob) throw new Error("INVITATION_ACK_UNAVAILABLE");
      const current = await readPersonInvitationJob(scope, currentJob);
      if (current.id !== currentJob.job_id) throw new Error("INVITATION_READ_UNAVAILABLE");
      if (!mounted.current) return;
      setJobStatus(current);
    } else {
      const current = await readAccessAction(scope, selection);
      if (!mounted.current) return;
      if (
        current.targetId !== currentIntent.targetId ||
        current.target?.state !== "revoked" ||
        !current.version ||
        current.version <= currentIntent.version
      )
        throw new Error("ACCESS_REREAD_UNAVAILABLE");
      setBase(current);
    }
    await onRefresh();
    if (mounted.current) setNotice("saved");
  }
  async function execute() {
    if (lock.current || !intent.current) return;
    lock.current = true;
    setWriting(true);
    try {
      if (!acknowledged.current) {
        const result = await writeAccessAction(intent.current);
        acknowledged.current = true;
        setHasAcknowledgement(true);
        job.current = result.job;
      }
      if (!mounted.current) return;
      setNotice("saved-unread");
      await reread();
    } catch (error) {
      if (!mounted.current || accessLost(error, acknowledged.current)) return;
      if (acknowledged.current) setNotice("saved-unread");
      else if (error instanceof BackendError && error.code === "VERSION_CONFLICT") {
        intent.current = undefined;
        setNotice("stale");
      } else if (
        error instanceof BackendError &&
        error.code !== "TRANSPORT_ERROR" &&
        !error.retryable
      ) {
        intent.current = undefined;
        setNotice("rejected");
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) setWriting(false);
    }
  }
  async function confirm(value: string) {
    if (lock.current || notice !== "ready" || !base || acknowledged.current) return;
    if (selection.kind === "unlink" && !value.trim()) {
      setReasonError(t(($) => $.access.reasonRequired));
      return;
    }
    try {
      intent.current = accessWriteIntent(base, value);
    } catch {
      setNotice("unavailable");
      return;
    }
    await execute();
  }
  async function refreshAcknowledged() {
    if (lock.current || !acknowledged.current) return;
    lock.current = true;
    setReading(true);
    try {
      await reread();
    } catch (error) {
      if (mounted.current && !accessLost(error, true)) setNotice("saved-unread");
    } finally {
      lock.current = false;
      if (mounted.current) setReading(false);
    }
  }
  const displayedSelection: AccessAction = base
    ? "account" in selection
      ? { ...selection, account: { ...selection.account, name: base.person.display_name } }
      : {
          ...selection,
          invitation: {
            ...selection.invitation,
            email: selection.kind === "cancel" ? selection.invitation.email : null,
            personName: base.person.display_name,
          },
        }
    : selection;
  const message =
    writing && !hasAcknowledgement
      ? t(($) => $.access.writing)
      : notice === "reading"
        ? t(($) => $.access.loading)
        : notice === "read-error"
          ? t(($) => $.access.readError)
          : notice === "unavailable"
            ? t(($) => $.access.actionUnavailable)
            : notice === "unknown"
              ? t(($) => $.studio.resourceUnknown)
              : notice === "stale"
                ? t(($) => $.access.stale)
                : notice === "rejected"
                  ? t(($) => $.people.writeRejected)
                  : notice === "saved-unread"
                    ? t(($) => $.access.savedUnread)
                    : notice === "saved"
                      ? jobStatus
                        ? [
                            t(($) => $.studio.invitationJobStates[jobStatus.state]),
                            jobStatus.email_delivery
                              ? t(
                                  ($) =>
                                    $.studio.invitationDeliveryStates[
                                      jobStatus.email_delivery!.state
                                    ],
                                )
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : t(($) => $.access.saved)
                      : undefined;
  const recovery =
    ["read-error", "stale", "rejected", "unknown", "saved-unread"].includes(notice) ||
    (notice === "saved" && Boolean(jobStatus)) ? (
      <div className="flex flex-wrap gap-2">
        {notice === "unknown" && (
          <Button
            variant="outline"
            isDisabled={writing || reading}
            onPress={() => {
              void execute();
            }}
          >
            {t(($) => $.studio.retrySameRequest)}
          </Button>
        )}
        {["read-error", "stale", "rejected"].includes(notice) && !isTerminal && (
          <Button
            variant="outline"
            isDisabled={reading || writing}
            onPress={() => {
              void load();
            }}
          >
            {t(($) => $.people.refresh)}
          </Button>
        )}
        {(notice === "saved-unread" || (notice === "saved" && Boolean(jobStatus))) && (
          <Button
            variant="outline"
            isDisabled={reading || writing}
            onPress={() => {
              void refreshAcknowledged();
            }}
          >
            {t(($) => $.people.refresh)}
          </Button>
        )}
      </div>
    ) : undefined;
  return (
    <AccessActionDialog
      selection={displayedSelection}
      onClose={onClose}
      onConfirm={
        notice === "ready" && base?.actionable && !reading && !writing
          ? (value) => {
              void confirm(value);
            }
          : undefined
      }
      reason={reason}
      onReason={(value) => {
        setReason(value);
        setReasonError(undefined);
      }}
      reading={reading}
      busy={writing}
      locked={preventClose}
      readOnly={hasAcknowledgement}
      error={reasonError}
      notice={message}
      recoveryActions={recovery}
    />
  );
}
