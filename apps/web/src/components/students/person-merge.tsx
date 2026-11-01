"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { PersonView, PersonSummary, Preview } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { ApiFailure, errorMessageKey } from "../../lib/api";
import type { MergeActions, MergeInput } from "../../lib/student-management";
import { studentError, uncertainStudentChange, type StudentScope } from "../../lib/students";
type Pending = { input: MergeInput; targetId: string; blocked?: boolean };
function recover(key: string, scope: StudentScope): Pending | "invalid" | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value === null) return null;
    const i = value.input;
    if (
      i?.org_id !== scope.orgId ||
      i.center_id !== scope.centerId ||
      typeof i.operation_key !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        i.operation_key,
      ) ||
      typeof i.preview?.id !== "string" ||
      typeof i.preview.token !== "string" ||
      !i.preview.token ||
      typeof value.targetId !== "string" ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean")
    )
      return "invalid";
    return {
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        operation_key: i.operation_key,
        preview: { id: i.preview.id, token: i.preview.token },
      },
      targetId: value.targetId,
      blocked: value.blocked,
    };
  } catch {
    return "invalid";
  }
}
export function PersonMerge({
  scope,
  person,
  actions,
  onMerged,
}: {
  scope: StudentScope;
  person: PersonView;
  actions: MergeActions;
  onMerged: (id: string) => void;
}) {
  const t = useTranslations("students");
  const api = useTranslations("api");
  const key = `ftksaas:person-merge:${scope.actorId}:${scope.orgId}:${scope.centerId}`;
  const [pending, setPending] = useState(() => recover(key, scope));
  const [opened, setOpened] = useState(!!pending);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ items: PersonSummary[]; next: string | null } | null>(
    null,
  );
  const [target, setTarget] = useState<PersonSummary | null>(null);
  const [clock, setClock] = useState(Date.now);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replayReady, setReplayReady] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!preview) return;
    const remaining = Date.parse(preview.expires_at) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.min(remaining, 2147483647));
    return () => window.clearTimeout(timer);
  }, [preview, clock]);
  const message = (code: string) =>
    t(t.has(`errors.${code}`) ? `errors.${code}` : "errors.unknown");
  function clear() {
    try {
      sessionStorage.removeItem(key);
      setPending(null);
      return true;
    } catch {
      setPending("invalid");
      setError("storageInvalid");
      return false;
    }
  }
  function persist(value: Pending) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      setPending(value);
    } catch (cause) {
      setPending("invalid");
      throw cause;
    }
  }
  async function search(event?: FormEvent, cursor?: string) {
    event?.preventDefault();
    if (lock.current || pending) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setTarget(null);
    setPreview(null);
    if (!cursor) setResults(null);
    try {
      const page = await actions.search(scope.orgId, scope.centerId, query.trim(), cursor);
      if (mounted.current)
        setResults({
          items: page.items.filter((p) => p.id !== person.id),
          next: page.next_cursor ?? null,
        });
    } catch (cause) {
      if (mounted.current) setError(studentError(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function inspect() {
    if (!target || lock.current || pending) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const result = await actions.preview({
        org_id: scope.orgId,
        center_id: scope.centerId,
        source_id: person.id,
        target_id: target.id,
      });
      if (!mounted.current) return;
      if (
        result.merge_summary?.source_id !== person.id ||
        result.merge_summary.target_id !== target.id
      )
        throw new Error("Unexpected merge preview");
      setClock(Date.now());
      setPreview(result);
    } catch (cause) {
      if (mounted.current) setError(studentError(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function apply(value: Pending) {
    if (lock.current || value.blocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let sent = false;
    try {
      persist(value);
      setReplayReady(true);
      sent = true;
      const result = await actions.apply(value.input);
      if (result.primary_id !== value.targetId) throw new Error("Unexpected merge target");
      if (mounted.current && clear()) onMerged(value.targetId);
    } catch (cause) {
      if (!mounted.current) return;
      const code = studentError(cause);
      if (!sent) {
        setPending("invalid");
        setError("storageInvalid");
      } else if (uncertainStudentChange(cause)) {
        try {
          persist({
            ...value,
            blocked:
              value.blocked ||
              ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code),
          });
        } catch {
          setPending("invalid");
        }
        setError(code);
      } else if (clear()) {
        setError(code);
        setPreview(null);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function check(value: Pending) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      setReplayReady(false);
      const result = await actions.status(
        scope.orgId,
        "person_merge_apply_v1",
        value.input.operation_key,
      );
      if (!mounted.current) return;
      if (result.operation !== "person_merge_apply_v1" || result.key !== value.input.operation_key)
        throw new Error("Unexpected merge receipt");
      if (["in_progress", "failed_retryable"].includes(result.status) && !value.blocked)
        setReplayReady(true);
      if (
        result.status === "succeeded" &&
        result.result_reference?.type === "people" &&
        result.result_reference.id === value.targetId
      ) {
        if (clear()) onMerged(value.targetId);
      } else if (result.status === "failed_final") {
        if (clear()) {
          setPreview(null);
          setError("failedFinal");
        }
      } else {
        if (result.status === "result_expired") persist({ ...value, blocked: true });
        setError(result.status);
      }
    } catch (cause) {
      if (mounted.current) {
        if (
          cause instanceof ApiFailure &&
          cause.failure.error.code === "NOT_FOUND" &&
          !value.blocked
        )
          setReplayReady(true);
        setError(studentError(cause));
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const blocked =
    !preview?.merge_summary ||
    preview.blockers.length > 0 ||
    preview.merge_summary.required_approval_center_ids.length > 0 ||
    !Number.isFinite(Date.parse(preview.expires_at)) ||
    Date.parse(preview.expires_at) <= clock;
  return (
    <section className="space-y-4 border-t pt-6" aria-label={t("mergeTitle")}>
      <h3 className="font-semibold">{t("mergeTitle")}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{t("mergeHint")}</p>
      {pending === "invalid" ? (
        <p role="alert">{t("storageInvalid")}</p>
      ) : (
        error && <p role="alert">{message(error)}</p>
      )}
      {pending && pending !== "invalid" ? (
        <div className="space-y-3">
          <p>{t("mergeUncertain")}</p>
          <Button disabled={busy} onClick={() => void check(pending)}>
            {t("check")}
          </Button>
          {!pending.blocked && replayReady && (
            <Button disabled={busy} variant="outline" onClick={() => void apply(pending)}>
              {t("retrySame")}
            </Button>
          )}
        </div>
      ) : (
        !pending && (
          <>
            {!opened ? (
              <Button variant="outline" onClick={() => setOpened(true)}>
                {t("mergeOpen")}
              </Button>
            ) : (
              <>
                <form onSubmit={(event) => void search(event)} className="space-y-3">
                  <Label htmlFor="merge-search">{t("mergeSearch")}</Label>
                  <Input
                    id="merge-search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setResults(null);
                      setTarget(null);
                      setPreview(null);
                    }}
                    disabled={busy}
                  />
                  <Button disabled={busy}>{t("searchButton")}</Button>
                </form>
                {results && (
                  <div className="space-y-2">
                    {results.items.length === 0 && <p>{t("noResults")}</p>}
                    {results.items.map((p) => (
                      <Button
                        key={p.id}
                        className="h-auto min-h-11 w-full whitespace-normal"
                        variant="outline"
                        disabled={busy}
                        aria-pressed={target?.id === p.id}
                        onClick={() => {
                          setTarget(p);
                          setPreview(null);
                        }}
                      >
                        {p.display_name}
                      </Button>
                    ))}
                    {results.next && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void search(undefined, results.next ?? undefined)}
                      >
                        {t("next")}
                      </Button>
                    )}
                  </div>
                )}
                {target && (
                  <div className="space-y-3">
                    <p>
                      {t("mergeDirection", {
                        source: person.display_name,
                        target: target.display_name,
                      })}
                    </p>
                    <Button disabled={busy} onClick={() => void inspect()}>
                      {t("mergePreview")}
                    </Button>
                  </div>
                )}
                {preview && (
                  <div className="space-y-3 rounded-lg border p-4">
                    <p>{t("mergeHistory")}</p>
                    <p>
                      {t("mergeCenters", {
                        count: preview.merge_summary?.affected_center_ids.length ?? 0,
                      })}
                    </p>
                    {Date.parse(preview.expires_at) <= clock && (
                      <p role="alert">{message("PREVIEW_STALE")}</p>
                    )}
                    {preview.blockers.map((b, i) => (
                      <p role="alert" key={i}>
                        {t.has(`errors.${b.code}`)
                          ? message(b.code)
                          : api(errorMessageKey(new ApiFailure({ ok: false, error: b })))}
                      </p>
                    ))}
                    {!!preview.merge_summary?.required_approval_center_ids.length && (
                      <p role="alert">
                        {t("mergeApprovalRequired", {
                          count: preview.merge_summary.required_approval_center_ids.length,
                        })}
                      </p>
                    )}
                    <Button
                      variant="destructive"
                      disabled={busy || blocked}
                      onClick={() => {
                        if (!target || blocked) return;
                        if (Date.parse(preview.expires_at) <= Date.now()) {
                          setPreview(null);
                          setError("PREVIEW_STALE");
                          return;
                        }
                        void apply({
                          targetId: target.id,
                          input: {
                            org_id: scope.orgId,
                            center_id: scope.centerId,
                            operation_key: v7(),
                            preview: { id: preview.id, token: preview.token },
                          },
                        });
                      }}
                    >
                      {t("mergeConfirm")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
