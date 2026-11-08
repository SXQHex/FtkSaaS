"use client";
import { useCallback, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { ImportColumn } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { importTargets, validateImportMapping } from "../../lib/reports";
import { importUploadKey } from "../../lib/import-upload";
import { jobKey, restoreJob } from "../../lib/job-record";
import type { SetupCommand, SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { ImportUpload } from "./import-upload";
import { ImportResults } from "./import-results";
import { WorkTemplatePicker } from "./work-template-picker";
export function ImportPanel({ scope }: { scope: SetupScope }) {
  const t = useTranslations("reports"),
    id = useId(),
    [fileId, setFileId] = useState(""),
    [namespace, setNamespace] = useState(""),
    [columns, setColumns] = useState<ImportColumn[]>([
      { source_column: "", target: "source_key" },
      { source_column: "", target: "display_name" },
    ]),
    [delimiter, setDelimiter] = useState<"," | ";">(","),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [canRestart, setCanRestart] = useState(false),
    [uploadBusy, setUploadBusy] = useState(false),
    [job, setJob] = useState<string | null>(() => {
      try {
        return restoreJob(scope, `import-preview:${scope.centerId}`);
      } catch {
        return null;
      }
    });
  const saved = useCallback((value?: string) => {
      if (value) setJob(value);
      setReview(null);
    }, []),
    command = useSetupCommand(scope, `import-preview:${scope.centerId}`, saved, setError),
    disabled = command.busy || !!command.pending || !!job;
  function newFile() {
    if (command.pending || command.busy || uploadBusy || (job && !canRestart)) return;
    try {
      sessionStorage.removeItem(importUploadKey(scope));
      sessionStorage.removeItem(jobKey(scope, `import-preview:${scope.centerId}`));
      sessionStorage.removeItem(jobKey(scope, `import-apply:${scope.centerId}`));
      setFileId("");
      setJob(null);
      setReview(null);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(flowError(e));
    }
  }
  return (
    <section className="min-w-0 space-y-5 wrap-anywhere">
      <h2 className="text-lg font-semibold">{t("import")}</h2>
      <p>{t("importHint")}</p>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      {!job && (
        <>
          <ImportUpload key={revision} scope={scope} onReady={setFileId} onBusy={setUploadBusy} />
          <WorkTemplatePicker
            contextKey={JSON.stringify([namespace, columns, delimiter])}
            scope={scope}
            kind="import"
            onResolved={(v) => {
              if (v.kind !== "import") return;
              try {
                if (v.request.center_id !== scope.centerId) throw Error("invalidImport");
                const m = validateImportMapping(v.request.mapping);
                setColumns(m.columns);
                setDelimiter(m.delimiter!);
                setNamespace(v.request.source_namespace);
                setReview(null);
              } catch (e) {
                setError(flowError(e));
              }
            }}
          />
          <form
            className="space-y-4"
            onChange={() => setReview(null)}
            onSubmit={(e) => {
              e.preventDefault();
              try {
                if (!fileId || !namespace.trim()) throw Error("invalidImport");
                const mapping = validateImportMapping({ kind: "students", columns, delimiter });
                setReview({
                  operation: "import_preview_v1",
                  input: {
                    org_id: scope.orgId,
                    center_id: scope.centerId,
                    operation_key: v7(),
                    file_id: fileId,
                    mapping,
                    source_namespace: namespace.trim(),
                  },
                });
                setError("");
              } catch (e) {
                setError(flowError(e));
              }
            }}
          >
            <fieldset disabled={disabled} className="space-y-3">
              <Label htmlFor={id}>{t("namespace")}</Label>
              <Input
                id={id}
                required
                value={namespace}
                maxLength={10000}
                onChange={(e) => setNamespace(e.target.value)}
              />
              <Label htmlFor={`${id}-delimiter`}>{t("delimiter")}</Label>
              <select
                id={`${id}-delimiter`}
                className="min-h-11 rounded-md border bg-background"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as "," | ";")}
              >
                <option value=",">{t("comma")}</option>
                <option value=";">{t("semicolon")}</option>
              </select>
              {columns.map((c, i) => (
                <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <Label htmlFor={`${id}-source-${i}`}>{t("sourceColumn")}</Label>
                    <Input
                      id={`${id}-source-${i}`}
                      required
                      value={c.source_column}
                      onChange={(e) =>
                        setColumns((v) =>
                          v.map((r, n) => (n === i ? { ...r, source_column: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${id}-target-${i}`}>{t("targetColumn")}</Label>
                    <select
                      id={`${id}-target-${i}`}
                      className="min-h-11 w-full rounded-md border bg-background"
                      value={c.target}
                      onChange={(e) =>
                        setColumns((v) =>
                          v.map((r, n) =>
                            n === i
                              ? { ...r, target: e.target.value as ImportColumn["target"] }
                              : r,
                          ),
                        )
                      }
                    >
                      {importTargets.map((k) => (
                        <option key={k} value={k}>
                          {t(`importFields.${k}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReview(null);
                      setColumns((v) => v.filter((_, n) => n !== i));
                    }}
                  >
                    {t("remove")}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={columns.length >= 100}
                onClick={() => {
                  setReview(null);
                  setColumns((v) => [...v, { source_column: "", target: "phone" }]);
                }}
              >
                {t("addColumn")}
              </Button>
              <Button type="submit" disabled={!fileId}>
                {t("preview")}
              </Button>
            </fieldset>
          </form>
          {review && (
            <ConfirmWrite
              key={review.input.operation_key}
              command={review}
              controller={command}
              onBack={() => setReview(null)}
            >
              <p>{t("previewOnly")}</p>
              <p>
                {namespace} · {delimiter}
              </p>
              {columns.map((c, i) => (
                <p key={i}>
                  {c.source_column} → {t(`importFields.${c.target}`)}
                </p>
              ))}
            </ConfirmWrite>
          )}
        </>
      )}
      {job && (
        <ImportResults key={job} scope={scope} previewJob={job} onCanRestart={setCanRestart} />
      )}
      <Button
        variant="outline"
        disabled={command.busy || !!command.pending || uploadBusy || (!!job && !canRestart)}
        onClick={newFile}
      >
        {t("newFile")}
      </Button>
    </section>
  );
}
