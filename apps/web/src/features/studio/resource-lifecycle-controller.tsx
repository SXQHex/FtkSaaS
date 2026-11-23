import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { capturePrivateReadback, clearPrivateQueries } from "../../lib/cache-invalidation";
import { Button } from "@ftksaas/ui/components/button";
import type { StudioScope } from "./studio";
import { ResourceLifecycleDialog } from "./resource-lifecycle-dialog";
import {
  readResourceLifecycle,
  resourceLifecycleIntent,
  writeResourceLifecycle,
  rereadResourceLifecycle,
  type ResourceLifecycleSelection,
  type ResourceLifecycleBase,
  type ResourceLifecycleIntent,
} from "./resource-lifecycle";

type Notice =
  | "reading"
  | "ready"
  | "closed"
  | "read-error"
  | "unknown"
  | "stale"
  | "rejected"
  | "saved-unread"
  | "saved";
const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export function ResourceLifecycleController({
  scope,
  selection,
  timezone,
  onClose,
  onLockChange,
  onRefresh,
}: {
  scope: StudioScope;
  selection: ResourceLifecycleSelection;
  timezone?: string;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const [base, setBase] = useState<ResourceLifecycleBase>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<Notice>("reading");
  const [busy, setBusy] = useState(false);
  const [hasAcknowledgement, setHasAcknowledgement] = useState(false);
  const mounted = useRef(true);
  const lock = useRef(false);
  const acknowledged = useRef(false);
  const intent = useRef<ResourceLifecycleIntent | undefined>(undefined);
  const initial = useRef({ scope, selection });
  const preventLeave = busy || notice === "unknown" || notice === "saved-unread";
  useEffect(() => {
    onLockChange(preventLeave);
    return () => onLockChange(false);
  }, [preventLeave, onLockChange]);
  useBlocker({
    shouldBlockFn: () => lock.current || notice === "unknown" || notice === "saved-unread",
    enableBeforeUnload: preventLeave,
    disabled: !preventLeave,
  });
  function accessLost(failure: unknown) {
    const code =
      failure instanceof BackendError
        ? failure.code
        : failure instanceof Error
          ? failure.message
          : undefined;
    if (!code || !["AUTH_REQUIRED", "ACCOUNT_CHANGED", "SESSION_REVOKED"].includes(code))
      return false;
    clearPrivateQueries(queries);
    onClose();
    void router.invalidate();
    return true;
  }
  const initialAccessLost = useEffectEvent(accessLost);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const assertCurrent = capturePrivateReadback(queries);
    async function load() {
      try {
        const next = await readResourceLifecycle(
          initial.current.scope,
          initial.current.selection,
        ).finally(assertCurrent);
        if (active) {
          setBase(next);
          setNotice(next.active ? "ready" : "closed");
        }
      } catch (failure) {
        if (active && !initialAccessLost(failure)) setNotice("read-error");
      }
    }
    void load();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [queries]);
  useEffect(() => {
    if (busy || notice === "reading") return;
    if (error) document.getElementById("resource-lifecycle-reason")?.focus();
    else if (notice !== "ready") document.getElementById("resource-lifecycle-notice")?.focus();
  }, [busy, error, notice]);
  async function reload() {
    if (lock.current || intent.current || acknowledged.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const next = await readResourceLifecycle(scope, selection).finally(
        capturePrivateReadback(queries),
      );
      if (mounted.current) {
        setBase(next);
        setReason("");
        setError(undefined);
        setNotice(next.active ? "ready" : "closed");
      }
    } catch (failure) {
      if (mounted.current && !accessLost(failure)) {
        setBase(undefined);
        setNotice("read-error");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function execute() {
    if (lock.current || !intent.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (!acknowledged.current) {
        const assertCurrent = capturePrivateReadback(queries);
        await writeResourceLifecycle(intent.current).catch((error: unknown) => {
          assertCurrent();
          throw error;
        });
        acknowledged.current = true;
        setHasAcknowledgement(true);
      }
      if (!mounted.current) return;
      setNotice("saved-unread");
      const assertCurrent = capturePrivateReadback(queries);
      const next = await rereadResourceLifecycle(intent.current).finally(assertCurrent);
      await onRefresh().finally(assertCurrent);
      if (mounted.current) {
        setBase(next);
        setNotice("saved");
      }
    } catch (failure) {
      if (!mounted.current || accessLost(failure)) return;
      if (acknowledged.current) {
        setBase(undefined);
        setNotice("saved-unread");
      } else if (
        failure instanceof BackendError &&
        failure.code !== "TRANSPORT_ERROR" &&
        !failure.retryable
      ) {
        intent.current = undefined;
        setNotice(failure.code === "VERSION_CONFLICT" ? "stale" : "rejected");
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function confirm() {
    if (lock.current || notice !== "ready" || !base) return;
    if (!reason.trim()) {
      setError(t(($) => $.studio.lifecycle.reasonRequired));
      return;
    }
    intent.current = resourceLifecycleIntent(base, reason);
    void execute();
  }
  const facts: { label: string; value: string }[] = base
    ? [{ label: t(($) => $.studio.scope), value: selection.label }]
    : [];
  const current = base?.current.current;
  if (current?.operation === "availability_save_v1" && current.values.rule) {
    const rule = current.values.rule;
    facts.push({
      label: t(($) => $.studio.period),
      value: `${rule.valid_from} – ${rule.valid_until ?? t(($) => $.studio.noEndDate)}`,
    });
    facts.push({
      label: t(($) => $.studio.availability),
      value: `${rule.weekdays.map((day) => (weekdays[day - 1] ? t(($) => $.studio.days[weekdays[day - 1]!]) : "")).join(", ")} · ${rule.local_start}–${rule.local_end}`,
    });
    if (timezone) facts.push({ label: t(($) => $.studio.lifecycle.timezone), value: timezone });
  } else if (current?.operation === "availability_exception_save_v1" && current.values.interval) {
    const format = new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone ?? "UTC",
      dateStyle: "medium",
      timeStyle: "short",
    });
    facts.push({
      label: t(($) => $.studio.period),
      value: `${format.format(new Date(current.values.interval.starts_at))} – ${format.format(new Date(current.values.interval.ends_at))} (${timezone ?? "UTC"})`,
    });
  }
  const message =
    notice === "ready"
      ? undefined
      : notice === "reading"
        ? t(($) => $.access.loading)
        : notice === "saved"
          ? t(($) => $.access.saved)
          : notice === "saved-unread"
            ? t(($) => $.access.savedUnread)
            : notice === "unknown"
              ? t(($) => $.studio.resourceUnknown)
              : notice === "stale"
                ? t(($) => $.access.stale)
                : notice === "closed"
                  ? selection.kind === "rule"
                    ? t(($) => $.studio.lifecycle.closed)
                    : t(($) => $.studio.lifecycle.cancelled)
                  : notice === "rejected"
                    ? t(($) => $.studio.resourceRejected)
                    : t(($) => $.studio.resourceReadError);
  return (
    <ResourceLifecycleDialog
      kind={selection.kind}
      facts={facts}
      reason={reason}
      onReason={(value) => {
        setReason(value);
        setError(undefined);
      }}
      onClose={onClose}
      onConfirm={notice === "ready" && !busy ? confirm : undefined}
      busy={busy}
      locked={notice === "unknown" || notice === "saved-unread"}
      readOnly={hasAcknowledgement || notice === "closed"}
      error={error}
      notice={message}
      recovery={
        ["unknown", "saved-unread", "read-error", "stale", "rejected"].includes(notice) ? (
          <div className="flex flex-wrap gap-2">
            {notice === "unknown" && (
              <Button
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  void execute();
                }}
              >
                {t(($) => $.studio.retrySameRequest)}
              </Button>
            )}
            {notice === "saved-unread" && (
              <Button
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  void execute();
                }}
              >
                {t(($) => $.studio.retryRead)}
              </Button>
            )}
            {["read-error", "stale", "rejected"].includes(notice) && (
              <Button
                variant="outline"
                isDisabled={busy}
                onPress={() => {
                  void reload();
                }}
              >
                {t(($) => $.studio.loadLatest)}
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
  );
}
