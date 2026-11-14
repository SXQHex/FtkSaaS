import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { StudioResourceForm, type ResourceSelection } from "./resource-form";
import {
  eligibleDisciplines,
  readStudioResource,
  resourceDraft,
  resourceIntent,
  saveStudioResource,
  type ResourceDraft,
  type ResourceIntent,
  type ResourceRecord,
  type StudioResources,
  type StudioScope,
} from "./studio";
import type { StudioClass } from "./studio-view";

type Notice =
  | "loading"
  | "ready"
  | "read-error"
  | "unknown"
  | "conflict"
  | "rejected"
  | "saved-unread";

// The parent keys this editor by account/org/center and selected entity. A scope
// change unmounts the old editor; a late response cannot populate a new scope.
export function StudioResourceEditor({
  scope,
  selection,
  resources,
  classMeta,
  onRefresh,
  onClose,
  onLockChange,
}: {
  scope: StudioScope;
  selection: ResourceSelection;
  resources: StudioResources;
  classMeta?: StudioClass;
  onRefresh: () => Promise<StudioResources>;
  onClose: () => void;
  onLockChange?: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [base, setBase] = useState<ResourceRecord>();
  const [initial, setInitial] = useState(() => resourceDraft());
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice>(selection.id ? "loading" : "ready");
  const [busy, setBusy] = useState(false);
  const [failureCode, setFailureCode] = useState<string>();
  const pending = useRef<ResourceIntent | undefined>(undefined);
  const acceptedId = useRef<string | undefined>(undefined);
  const locked = useRef(false);
  const mounted = useRef(true);
  const preventLeave = busy || notice === "unknown" || notice === "saved-unread";
  useBlocker({
    shouldBlockFn: () => locked.current || Boolean(pending.current) || Boolean(acceptedId.current),
    enableBeforeUnload: preventLeave,
    disabled: !preventLeave,
  });
  useEffect(() => {
    onLockChange?.(preventLeave);
    return () => onLockChange?.(false);
  }, [onLockChange, preventLeave]);

  const { accountId, orgId, centerId } = scope;
  const { kind, id } = selection;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    if (id) {
      void readStudioResource({ accountId, orgId, centerId }, kind, id)
        .then((value) => {
          if (!active) return;
          setBase(value);
          setInitial(resourceDraft(value));
          setRevision((value) => value + 1);
          setNotice("ready");
        })
        .catch(() => {
          if (active) setNotice("read-error");
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [accountId, orgId, centerId, kind, id]);

  async function reload() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const next = selection.id
        ? await readStudioResource(scope, selection.kind, selection.id)
        : undefined;
      await onRefresh();
      if (!mounted.current) return;
      setBase(next);
      setInitial(resourceDraft(next));
      setRevision((value) => value + 1);
      pending.current = undefined;
      setFailureCode(undefined);
      setNotice("ready");
    } catch {
      if (mounted.current) setNotice("read-error");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function reread() {
    const next = await onRefresh();
    const items = selection.kind === "room" ? next.rooms : next.classes;
    if (!acceptedId.current || !items.some((item) => item.id === acceptedId.current))
      throw new Error("STUDIO_UNAVAILABLE");
    if (mounted.current) onClose();
  }

  async function retryRead() {
    if (locked.current || !acceptedId.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await reread();
    } catch {
      if (mounted.current) setNotice("saved-unread");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function write(draft?: ResourceDraft) {
    if (locked.current || (draft && notice !== "ready")) return;
    const intent = draft ? resourceIntent(scope, selection.kind, draft, base) : pending.current;
    if (!intent || acceptedId.current) return;
    pending.current = intent;
    locked.current = true;
    setBusy(true);
    setFailureCode(undefined);
    try {
      const result = await saveStudioResource(intent);
      acceptedId.current = result.primary_id!;
      pending.current = undefined;
      if (mounted.current) setNotice("saved-unread");
      // A known successful write is never repeated, even when its read fails.
      await reread();
    } catch (error) {
      if (!mounted.current) return;
      if (acceptedId.current) setNotice("saved-unread");
      else if (
        error instanceof BackendError &&
        error.code !== "TRANSPORT_ERROR" &&
        (!error.retryable || error.code === "VERSION_CONFLICT")
      ) {
        pending.current = undefined;
        setFailureCode(error.code);
        setNotice(error.code === "VERSION_CONFLICT" ? "conflict" : "rejected");
      } else if (
        error instanceof Error &&
        ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message)
      ) {
        pending.current = undefined;
        setFailureCode(error.message);
        setNotice("rejected");
      } else setNotice("unknown");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const disciplines = eligibleDisciplines(resources.disciplines).map(({ id, name }) => ({
    id,
    name,
    disabled: false,
  }));
  if (base?.kind === "class" && !disciplines.some((item) => item.id === base.disciplineId)) {
    const current = resources.disciplines.find((item) => item.id === base.disciplineId);
    disciplines.push({
      id: base.disciplineId,
      name: current?.name ?? t(($) => $.studio.unavailableDiscipline),
      disabled: true,
    });
  }
  const message =
    notice === "ready"
      ? undefined
      : notice === "loading"
        ? t(($) => $.studio.loading)
        : notice === "read-error"
          ? t(($) => $.studio.resourceReadError)
          : notice === "unknown"
            ? t(($) => $.studio.resourceUnknown)
            : notice === "conflict"
              ? t(($) => $.studio.resourceConflict)
              : notice === "saved-unread"
                ? t(($) => $.studio.resourceSavedUnread)
                : failureCode === "OPEN_OPERATIONS_EXIST"
                  ? t(($) => $.studio.resourceOpenOperations)
                  : failureCode === "CAPACITY_FULL"
                    ? t(($) => $.studio.resourceCapacityFull)
                    : t(($) => $.studio.resourceRejected);
  const recovery =
    notice === "ready" || notice === "loading"
      ? undefined
      : {
          label:
            notice === "unknown"
              ? t(($) => $.studio.retrySameRequest)
              : notice === "saved-unread"
                ? t(($) => $.studio.retryRead)
                : t(($) => $.studio.loadLatest),
          onPress: () => {
            void (notice === "unknown"
              ? write()
              : notice === "saved-unread"
                ? retryRead()
                : reload());
          },
        };
  return (
    <StudioResourceForm
      key={revision}
      selection={selection}
      initial={initial}
      disciplines={disciplines}
      classMeta={classMeta}
      busy={busy}
      locked={notice !== "ready"}
      preventClose={preventLeave}
      message={message}
      messageTone={notice === "loading" || notice === "saved-unread" ? "info" : "error"}
      recovery={recovery}
      effects={base?.effects?.count}
      onSubmit={write}
      onClose={onClose}
    />
  );
}
