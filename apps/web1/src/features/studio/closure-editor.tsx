import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { StudioSheets } from "./studio-sheets";
import {
  ClosureTimeError,
  closureIntent,
  readClosureContext,
  saveClosure,
  type ClosureContext,
  type ClosureDraft,
  type ClosureIntent,
} from "./closure";
import { readStudioClosures } from "./studio-reads";
import type { StudioScope } from "./studio";
import type { StudioViewData } from "./studio-view";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

type Notice =
  | "loading"
  | "ready"
  | "read-error"
  | "invalid"
  | "ambiguous"
  | "date-unavailable"
  | "unknown"
  | "conflict"
  | "rejected"
  | "saved-unread";

export function StudioClosureEditor({
  scope,
  data,
  onRefresh,
  onClose,
  onLockChange,
}: {
  scope: StudioScope;
  data: StudioViewData;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [context, setContext] = useState<ClosureContext>();
  const [notice, setNotice] = useState<Notice>("loading");
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [revision, setRevision] = useState(0);
  const [offsets, setOffsets] = useState<{ startOffsets: string[]; endOffsets: string[] }>();
  const pending = useRef<ClosureIntent | undefined>(undefined);
  const acknowledged = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const mounted = useRef(true);
  const summary = useRef<HTMLDivElement>(null);
  const preventClose = mutating || notice === "unknown" || notice === "saved-unread";
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { accountId, orgId, centerId } = scope;
  useEffect(() => {
    let active = true;
    void readClosureContext({ accountId, orgId, centerId })
      .then((result) => {
        if (active && mounted.current) {
          setContext(result);
          setNotice("ready");
        }
      })
      .catch(() => {
        if (active && mounted.current) setNotice("read-error");
      });
    return () => {
      active = false;
    };
  }, [accountId, orgId, centerId]);
  useEffect(() => {
    onLockChange(preventClose);
    return () => onLockChange(false);
  }, [preventClose, onLockChange]);
  useBlocker({
    shouldBlockFn: () => Boolean(pending.current),
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });
  function close() {
    if (preventClose || acknowledged.current || pending.current) return;
    mounted.current = false;
    onClose();
  }
  async function finishRead() {
    const intent = pending.current;
    if (!intent || !acknowledged.current) return;
    const [items] = await Promise.all([readStudioClosures(scope, intent.resource), onRefresh()]);
    if (!items.some((item) => item.id === acknowledged.current))
      throw new Error("STUDIO_UNAVAILABLE");
    if (mounted.current) {
      pending.current = undefined;
      acknowledged.current = undefined;
      onClose();
    }
  }
  async function write(draft?: ClosureDraft) {
    if (lock.current || acknowledged.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (draft) {
        if (!context || !["ready", "invalid", "ambiguous", "date-unavailable"].includes(notice))
          return;
        try {
          pending.current = await closureIntent(context, draft);
        } catch (error) {
          if (!mounted.current) return;
          if (error instanceof ClosureTimeError) {
            setOffsets({ startOffsets: error.startOffsets, endOffsets: error.endOffsets });
            setNotice("ambiguous");
          } else
            setNotice(
              error instanceof Error && error.message === "CLOSURE_DATE_UNAVAILABLE"
                ? "date-unavailable"
                : "invalid",
            );
          requestAnimationFrame(() => summary.current?.focus());
          return;
        }
      }
      if (!mounted.current || !pending.current) return;
      setMutating(true);
      acknowledged.current = await saveClosure(pending.current);
      if (mounted.current) setNotice("saved-unread");
      await finishRead();
    } catch (error) {
      if (!mounted.current) return;
      if (acknowledged.current) setNotice("saved-unread");
      else if (
        (error instanceof BackendError &&
          error.code !== "TRANSPORT_ERROR" &&
          (!error.retryable || error.code === "VERSION_CONFLICT")) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        pending.current = undefined;
        setNotice(
          error instanceof BackendError && error.code === "VERSION_CONFLICT"
            ? "conflict"
            : "rejected",
        );
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setMutating(false);
      }
    }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const saved = Boolean(acknowledged.current);
    try {
      if (saved) {
        await finishRead();
        return;
      }
      const next = await readClosureContext(scope);
      await onRefresh();
      if (!mounted.current) return;
      setContext(next);
      setOffsets(undefined);
      setRevision((value) => value + 1);
      setNotice("ready");
    } catch {
      if (mounted.current) setNotice(saved ? "saved-unread" : "read-error");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const message =
    notice === "loading"
      ? t(($) => $.studio.loading)
      : notice === "read-error"
        ? t(($) => $.studio.resourceReadError)
        : notice === "invalid"
          ? t(($) => $.studio.closureInvalid)
          : notice === "ambiguous"
            ? t(($) => $.studio.closureAmbiguous)
            : notice === "date-unavailable"
              ? t(($) => $.studio.closureDateUnavailable)
              : notice === "unknown"
                ? t(($) => $.studio.resourceUnknown)
                : notice === "conflict"
                  ? t(($) => $.studio.closureConflict)
                  : notice === "rejected"
                    ? t(($) => $.studio.closureRejected)
                    : notice === "saved-unread"
                      ? t(($) => $.studio.closureSavedUnread)
                      : undefined;
  return (
    <StudioSheets
      key={revision}
      selection={{ kind: "closure" }}
      data={data}
      onClose={close}
      preventClose={preventClose}
      closureControl={{
        enabled: Boolean(
          context &&
          !busy &&
          ["ready", "invalid", "ambiguous", "date-unavailable"].includes(notice),
        ),
        onSubmit: (draft) => {
          void write(draft);
        },
        timezone: context?.center.timezone,
        offsets,
        notice: message && (
          <Alert
            ref={summary}
            tabIndex={-1}
            role="status"
            variant={["loading", "saved-unread"].includes(notice) ? "default" : "destructive"}
          >
            <AlertDescription className="flex flex-col items-start gap-3">
              {message}
              {notice === "unknown" ? (
                <Button
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => {
                    void write();
                  }}
                >
                  {t(($) => $.studio.retrySameRequest)}
                </Button>
              ) : (
                ["read-error", "conflict", "rejected", "saved-unread"].includes(notice) && (
                  <Button
                    variant="outline"
                    isDisabled={busy}
                    onPress={() => {
                      void reload();
                    }}
                  >
                    {notice === "conflict" || notice === "rejected"
                      ? t(($) => $.studio.loadLatest)
                      : t(($) => $.studio.retryRead)}
                  </Button>
                )
              )}
            </AlertDescription>
          </Alert>
        ),
      }}
    />
  );
}
