"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { ApiFailure } from "../../lib/api";
import { isUncertainSetup, type SetupScope } from "../../lib/studio-setup";
import {
  continueDocumentUpload,
  documentFileHash,
  restoreUpload,
  reconcileDocumentUpload,
  uploadStorageKey,
  type UploadJournal,
} from "../../lib/documents";
import { errorKey } from "../setup/setup-command";
export function DocumentUpload({
  scope,
  targetDocumentId,
  onReady,
}: {
  scope: SetupScope;
  targetDocumentId?: string;
  onReady: (fileId: string, documentId?: string) => void;
}) {
  const t = useTranslations("documents"),
    setup = useTranslations("setup"),
    id = useId();
  const [record, setRecord] = useState(() => restoreUpload(scope));
  const [retainedTarget, setRetainedTarget] = useState(targetDocumentId);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const current = useRef(record),
    alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function checkpoint(next: UploadJournal) {
    if (!alive.current) throw Error("stopped");
    try {
      sessionStorage.setItem(uploadStorageKey(scope), JSON.stringify(next));
    } catch {
      throw Error("storageFailed");
    }
    current.current = next;
    setRecord(next);
  }
  async function run() {
    if (lock.current || record === "invalid" || record?.blocked) return;
    lock.current = true;
    setBusy(true);
    setClock(Date.now());
    setError("");
    const fresh = !record;
    try {
      let next = record;
      if (!next) {
        if (!file) throw Error("invalidFile");
        const checksum = await documentFileHash(file);
        if (!alive.current) return;
        next = {
          prepare: {
            org_id: scope.orgId,
            ...(scope.centerId ? { center_id: scope.centerId } : {}),
            operation_key: v7(),
            name: file.name,
            mime: file.type,
            bytes: file.size,
          },
          checksum,
          completeKey: v7(),
          phase: "prepare",
          ...(retainedTarget ? { documentId: retainedTarget } : {}),
        };
        checkpoint(next);
      }
      const ready = await continueDocumentUpload(
        scope,
        next,
        file,
        checkpoint,
        () => alive.current,
      );
      if (alive.current && ready.fileId) onReady(ready.fileId, ready.documentId);
    } catch (cause) {
      if (!alive.current) return;
      if (cause instanceof ApiFailure) {
        if (
          fresh &&
          current.current &&
          current.current !== "invalid" &&
          current.current.phase === "prepare" &&
          !isUncertainSetup(cause)
        ) {
          try {
            sessionStorage.removeItem(uploadStorageKey(scope));
            current.current = null;
            setRecord(null);
          } catch {
            setRecord("invalid");
          }
        } else if (
          ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(
            cause.failure.error.code,
          ) &&
          current.current &&
          current.current !== "invalid"
        ) {
          try {
            checkpoint({ ...current.current, blocked: true });
          } catch {
            setRecord("invalid");
          }
        }
        setError(setup(errorKey(cause.failure.error.code)));
      } else
        setError(
          t(
            cause instanceof Error &&
              ["invalidFile", "sameFileRequired", "storageFailed", "invalidUpload"].includes(
                cause.message,
              )
              ? cause.message
              : "uploadFailed",
          ),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function check() {
    if (lock.current || !record || record === "invalid") return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await reconcileDocumentUpload(scope, record);
      if (!alive.current) return;
      checkpoint(next);
      if (next.phase === "ready" && next.fileId) onReady(next.fileId, next.documentId);
      else if (!next.restartable) setError(t("checkPending"));
    } catch {
      if (alive.current) setError(t("checkFailed"));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const expired =
    record &&
    record !== "invalid" &&
    record.phase !== "complete" &&
    record.phase !== "ready" &&
    record.expiresAt &&
    Date.parse(record.expiresAt) <= clock;
  function restart() {
    try {
      if (record && record !== "invalid" && record.documentId) setRetainedTarget(record.documentId);
      sessionStorage.removeItem(uploadStorageKey(scope));
      current.current = null;
      setRecord(null);
      setFile(null);
      setError("");
    } catch {
      setError(t("storageFailed"));
    }
  }
  return (
    <section aria-label={t("uploadTitle")} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{t("uploadTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("uploadHint")}</p>
      {(retainedTarget || (record && record !== "invalid" && record.documentId)) && (
        <p className="text-sm">{t("nextVersion")}</p>
      )}
      {record === "invalid" ? (
        <p role="alert">{t("storageFailed")}</p>
      ) : record?.phase === "ready" ? (
        <>
          <output className="block">{t("uploadReady", { name: record.prepare.name })}</output>
          <div className="flex flex-wrap gap-3">
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              onClick={() => {
                if (record.fileId) onReady(record.fileId, record.documentId);
              }}
            >
              {t("openPublication")}
            </Button>
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={restart}
            >
              {t("newUpload")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {record && (
            <p className="break-words text-sm">{t("resumeHint", { name: record.prepare.name })}</p>
          )}
          {record?.blocked ? (
            <p role="alert">{t("blockedUpload")}</p>
          ) : (
            <>
              {record?.phase !== "complete" && (
                <div className="space-y-2">
                  <Label htmlFor={id}>{t("file")}</Label>
                  <Input
                    key={record?.prepare.operation_key ?? "new"}
                    id={id}
                    type="file"
                    accept="application/pdf,text/plain"
                    disabled={busy}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal"
                disabled={
                  busy || (record?.phase !== "complete" && record?.phase !== "upload" && !file)
                }
                onClick={() => void run()}
              >
                {t(busy ? "uploading" : record ? "resumeUpload" : "startUpload")}
              </Button>
            </>
          )}
          {record && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              disabled={busy}
              onClick={() => void check()}
            >
              {t("checkUpload")}
            </Button>
          )}
          {(expired || record?.restartable) && (
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              variant="outline"
              onClick={restart}
              disabled={busy}
            >
              {t("restartUpload")}
            </Button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
