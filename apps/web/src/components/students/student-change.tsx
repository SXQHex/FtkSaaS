"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { PersonView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import {
  recoverStudentChange,
  studentError,
  studentState,
  studentStorageKey,
  uncertainStudentChange,
  type PendingStudentChange,
  type StudentActions,
  type StudentScope,
} from "../../lib/students";

type Stage =
  | { phase: "idle" | "review"; error?: string }
  | { phase: "saving" | "checking" | "uncertain"; pending: PendingStudentChange; error?: string }
  | { phase: "success" | "storageInvalid" };
const buttonClass = "h-auto min-h-11 max-w-full whitespace-normal";

export function StudentChange({
  scope,
  personId,
  person,
  centerName,
  actions,
  onSaved,
}: {
  scope: StudentScope;
  personId: string;
  person?: PersonView;
  centerName: string;
  actions: StudentActions;
  onSaved: () => void;
}) {
  const t = useTranslations("students");
  const [stage, setStage] = useState<Stage>(() => {
    const pending = recoverStudentChange(scope, personId);
    return pending === "invalid"
      ? { phase: "storageInvalid" }
      : pending
        ? { phase: "uncertain", pending }
        : { phase: "idle" };
  });
  const [reason, setReason] = useState("");
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const deactivating = person && studentState(person, scope.centerId) === "active";
  const storageKey = studentStorageKey(scope, personId);
  const message = (code: string) =>
    t(t.has(`errors.${code}`) ? `errors.${code}` : "errors.unknown");
  function clear() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* A retained receipt can still be checked safely. */
    }
  }
  function persist(pending: PendingStudentChange) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pending));
      return true;
    } catch {
      setStage({ phase: "storageInvalid" });
      return false;
    }
  }
  function unresolved(pending: PendingStudentChange, error: string, blocked = false) {
    const next = { ...pending, blocked: pending.blocked || blocked };
    if (persist(next)) setStage({ phase: "uncertain", pending: next, error });
  }
  async function apply(pending: PendingStudentChange, recovering = false) {
    if (locked.current || pending.blocked || !persist(pending)) return;
    locked.current = true;
    setStage({ phase: "saving", pending });
    try {
      await actions.change(pending.command);
      if (!mounted.current) return;
      clear();
      setStage({ phase: "success" });
    } catch (error) {
      if (!mounted.current) return;
      const code = studentError(error);
      if (recovering || uncertainStudentChange(error))
        unresolved(
          pending,
          code,
          ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code),
        );
      else {
        clear();
        setStage({ phase: "idle", error: code });
      }
    } finally {
      locked.current = false;
    }
  }
  async function check(pending: PendingStudentChange) {
    if (locked.current) return;
    locked.current = true;
    setStage({ phase: "checking", pending });
    try {
      const { operation, input } = pending.command;
      const result = await actions.status(scope.orgId, operation, input.operation_key);
      if (!mounted.current) return;
      if (result.operation !== operation || result.key !== input.operation_key)
        throw new Error("Unexpected operation status");
      // The receipt references a center relationship, never the person's ID.
      if (
        result.status === "succeeded" &&
        result.result_reference?.type === "center_relationships"
      ) {
        clear();
        setStage({ phase: "success" });
      } else if (result.status === "failed_final") {
        clear();
        setStage({ phase: "idle", error: "failedFinal" });
      } else unresolved(pending, result.status, result.status === "result_expired");
    } catch (error) {
      if (mounted.current) unresolved(pending, studentError(error));
    } finally {
      locked.current = false;
    }
  }
  function confirm(event: FormEvent) {
    event.preventDefault();
    if (!person || locked.current || (deactivating && !reason.trim())) return;
    const input = {
      org_id: scope.orgId,
      center_id: scope.centerId,
      person_id: personId,
      operation_key: v7(),
    };
    void apply({
      command: deactivating
        ? { operation: "student_deactivate_v1", input: { ...input, reason: reason.trim() } }
        : { operation: "student_activate_v1", input },
    });
  }
  if (!person && (stage.phase === "idle" || stage.phase === "review")) return null;
  return (
    <section
      className="min-w-0 space-y-4 border-t pt-6 wrap-anywhere"
      aria-label={t("relationship")}
    >
      <h3 className="font-semibold">{t("relationship")}</h3>
      {"error" in stage && stage.error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm leading-6">
          {message(stage.error)}
        </p>
      )}
      {stage.phase === "idle" && person && (
        <>
          <p className="text-sm leading-6 text-muted-foreground">
            {t(deactivating ? "deactivateHint" : "activateHint", { center: centerName })}
          </p>
          <Button
            variant="outline"
            className={buttonClass}
            onClick={() => setStage({ phase: "review" })}
          >
            {t(deactivating ? "deactivate" : "activate")}
          </Button>
        </>
      )}
      {stage.phase === "review" && person && (
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-sm leading-6">
            {t(deactivating ? "confirmDeactivate" : "confirmActivate", {
              name: person.display_name,
              center: centerName,
            })}
          </p>
          {deactivating && (
            <div className="space-y-2">
              <Label htmlFor="student-change-reason">{t("reason")}</Label>
              <textarea
                id="student-change-reason"
                required
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full min-w-0 rounded-md border bg-background p-3 text-sm"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              className={buttonClass}
              disabled={!!deactivating && !reason.trim()}
            >
              {t(deactivating ? "confirmDeactivateButton" : "confirmActivateButton")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={buttonClass}
              onClick={() => setStage({ phase: "idle" })}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      {(stage.phase === "saving" || stage.phase === "checking") && (
        <output className="block text-sm" aria-live="polite">
          {t(stage.phase)}
        </output>
      )}
      {stage.phase === "uncertain" && (
        <div className="space-y-4">
          <p className="font-medium">{t("uncertain")}</p>
          <p className="text-sm leading-6 text-muted-foreground">{t("uncertainHint")}</p>
          <p className="text-sm">
            {t(
              stage.pending.command.operation === "student_activate_v1"
                ? "pendingActivate"
                : "pendingDeactivate",
              { center: centerName },
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className={buttonClass} onClick={() => void check(stage.pending)}>
              {t("check")}
            </Button>
            {!stage.pending.blocked && (
              <Button
                variant="outline"
                className={buttonClass}
                onClick={() => void apply(stage.pending, true)}
              >
                {t("retrySame")}
              </Button>
            )}
          </div>
        </div>
      )}
      {stage.phase === "success" && (
        <div className="space-y-4">
          <output className="block font-medium" aria-live="polite">
            {t("saved")}
          </output>
          <Button className={buttonClass} onClick={onSaved}>
            {t("viewCurrent")}
          </Button>
        </div>
      )}
      {stage.phase === "storageInvalid" && (
        <p role="alert" className="text-sm leading-6">
          {t("storageInvalid")}
        </p>
      )}
    </section>
  );
}
