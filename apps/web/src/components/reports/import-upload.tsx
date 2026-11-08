"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import {
  continueImportUpload,
  importUploadKey,
  newImportUpload,
  restoreImportUpload,
  type ImportUpload as Upload,
} from "../../lib/import-upload";
import type { SetupScope } from "../../lib/studio-setup";
import { FlowError, flowError } from "../bookings/flow-controls";
export function ImportUpload({
  scope,
  onReady,
  onBusy,
}: {
  scope: SetupScope;
  onReady: (id: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const t = useTranslations("reports"),
    id = useId(),
    [record, setRecord] = useState<Upload | "invalid" | null>(() => {
      try {
        return restoreImportUpload(scope);
      } catch {
        return "invalid";
      }
    }),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (record && record !== "invalid" && record.phase === "ready" && record.fileId)
      onReady(record.fileId);
  }, [record, onReady]);
  useEffect(() => {
    onBusy?.(busy);
    return () => {
      onBusy?.(false);
    };
  }, [busy, onBusy]);
  function checkpoint(r: Upload) {
    if (!alive.current) throw Error("stopped");
    sessionStorage.setItem(importUploadKey(scope), JSON.stringify(r));
    setRecord(r);
  }
  async function run() {
    if (lock.current || record === "invalid") return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let r = record;
      if (!r) {
        if (!file) throw Error("invalidImport");
        r = await newImportUpload(scope, file);
        checkpoint(r);
      }
      await continueImportUpload(r, file, checkpoint, () => alive.current);
    } catch (e) {
      if (alive.current) setError(flowError(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="font-semibold">{t("upload")}</h3>
      <p>{t("uploadHint")}</p>
      {record === "invalid" ? (
        <FlowError code="invalidImport" />
      ) : record?.phase === "ready" ? (
        <output>{t("uploadReady")}</output>
      ) : (
        <>
          <Label htmlFor={id}>{t("csvFile")}</Label>
          <Input
            id={id}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {record && <p>{t("sameFile", { name: record.prepare.filename })}</p>}
          <Button disabled={busy || (!record && !file)} onClick={() => void run()}>
            {t(busy ? "loading" : record ? "resume" : "upload")}
          </Button>
        </>
      )}
      {error && <FlowError code={error} />}
    </section>
  );
}
