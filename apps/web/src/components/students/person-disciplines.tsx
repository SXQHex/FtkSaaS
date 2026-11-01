"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { DisciplineView, PersonView } from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { studentError, uncertainStudentChange, type StudentScope } from "../../lib/students";
import { ApiFailure } from "../../lib/api";
import type { DisciplineActions, DisciplineInput } from "../../lib/student-management";
type Pending = { input: DisciplineInput; blocked?: boolean };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function recover(key: string, scope: StudentScope, personId: string): Pending | "invalid" | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value === null) return null;
    const input = value.input;
    if (
      input?.org_id !== scope.orgId ||
      input.center_id !== scope.centerId ||
      input.person_id !== personId ||
      !uuid.test(input.operation_key) ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.discipline_id) ||
      input.kind !== "student" ||
      !["active", "inactive"].includes(input.state) ||
      (input.expected_version !== undefined &&
        (!Number.isSafeInteger(input.expected_version) || input.expected_version < 1)) ||
      (value.blocked !== undefined && typeof value.blocked !== "boolean")
    )
      return "invalid";
    return {
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: personId,
        discipline_id: input.discipline_id,
        kind: "student",
        state: input.state,
        operation_key: input.operation_key,
        ...(input.expected_version !== undefined
          ? { expected_version: input.expected_version }
          : {}),
      },
      blocked: value.blocked,
    };
  } catch {
    return "invalid";
  }
}
export function PersonDisciplines({
  scope,
  person,
  actions,
  onSaved,
}: {
  scope: StudentScope;
  person: PersonView;
  actions: DisciplineActions;
  onSaved: () => void;
}) {
  const t = useTranslations("students");
  const key = `ftksaas:person-discipline:${scope.actorId}:${scope.orgId}:${scope.centerId}:${person.id}`;
  const [pending, setPending] = useState(() => recover(key, scope, person.id));
  const [catalog, setCatalog] = useState<DisciplineView[] | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replayReady, setReplayReady] = useState(false);
  const [opened, setOpened] = useState(!!pending);
  const [selected, setSelected] = useState("");
  const [state, setState] = useState<"active" | "inactive">("active");
  const lock = useRef(false);
  const mounted = useRef(true);
  const relations = person.discipline_relationships.filter(
    (r) => r.center_id === scope.centerId && r.kind === "student",
  );
  const hasRelations = relations.length > 0;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!opened && !hasRelations) return;
    let active = true;
    actions
      .list(scope.orgId)
      .then((items) => {
        if (active) setCatalog(items);
      })
      .catch((cause) => {
        if (active) {
          setCatalogFailed(true);
          setError(studentError(cause));
        }
      });
    return () => {
      active = false;
    };
  }, [opened, hasRelations, actions, scope.orgId, catalogAttempt]);
  function persist(value: Pending) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      setPending(value);
    } catch (cause) {
      setPending("invalid");
      throw cause;
    }
  }
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
  function committed() {
    if (clear()) onSaved();
  }
  async function save(value: Pending) {
    if (lock.current || value.blocked) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let sent = false;
    try {
      persist(value);
      setReplayReady(true);
      sent = true;
      await actions.save(value.input);
      if (mounted.current) committed();
    } catch (cause) {
      if (!mounted.current) return;
      const code = studentError(cause);
      if (!sent) {
        setPending("invalid");
        setError("storageInvalid");
      } else if (uncertainStudentChange(cause)) {
        const blocked =
          value.blocked ||
          ["OPERATION_RESULT_EXPIRED", "IDEMPOTENCY_PAYLOAD_MISMATCH"].includes(code);
        try {
          persist({ ...value, blocked });
        } catch {
          setPending("invalid");
        }
        setError(code);
      } else if (clear()) setError(code);
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
        "person_discipline_set_v1",
        value.input.operation_key,
      );
      if (!mounted.current) return;
      if (
        result.operation !== "person_discipline_set_v1" ||
        result.key !== value.input.operation_key
      )
        throw new Error("Unexpected discipline receipt");
      if (["in_progress", "failed_retryable"].includes(result.status) && !value.blocked)
        setReplayReady(true);
      if (result.status === "succeeded") committed();
      else if (result.status === "failed_final") {
        if (clear()) setError("failedFinal");
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
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      pending ||
      !catalog?.some((d) => d.id === selected && (d.state === "active" || state === "inactive"))
    )
      return;
    const relation = relations.find((r) => r.discipline_id === selected);
    void save({
      input: {
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: person.id,
        discipline_id: selected,
        kind: "student",
        state,
        operation_key: v7(),
        ...(relation ? { expected_version: relation.version } : {}),
      },
    });
  }
  return (
    <section className="space-y-4 border-t pt-6" aria-label={t("disciplineTitle")}>
      <h3 className="font-semibold">{t("disciplineTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("disciplineHint")}</p>
      {relations.map((r) => (
        <p key={r.discipline_id} className="text-sm">
          {catalog?.find((d) => d.id === r.discipline_id)?.name ?? t("disciplineRecorded")} —{" "}
          {t(`states.${r.state}`)}
        </p>
      ))}
      {!opened && (
        <Button variant="outline" onClick={() => setOpened(true)}>
          {t("disciplineEdit")}
        </Button>
      )}
      {error && pending !== "invalid" && (
        <p role="alert">{t(t.has(`errors.${error}`) ? `errors.${error}` : "errors.unknown")}</p>
      )}
      {pending === "invalid" ? (
        <p role="alert">{t("storageInvalid")}</p>
      ) : pending ? (
        <div className="space-y-3">
          <p>{t("disciplineUncertain")}</p>
          <Button disabled={busy} onClick={() => void check(pending)}>
            {t("check")}
          </Button>
          {!pending.blocked && replayReady && (
            <Button variant="outline" disabled={busy} onClick={() => void save(pending)}>
              {t("retrySame")}
            </Button>
          )}
        </div>
      ) : (
        opened && (
          <form onSubmit={submit} className="space-y-3">
            {catalogFailed ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setCatalogFailed(false);
                  setCatalogAttempt((attempt) => attempt + 1);
                }}
              >
                {t("retry")}
              </Button>
            ) : !catalog ? (
              <output>{t("loadingDetail")}</output>
            ) : (
              <>
                <Label htmlFor="person-discipline">{t("disciplineLabel")}</Label>
                <select
                  id="person-discipline"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={busy}
                  required
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  <option value="">{t("disciplineSelect")}</option>
                  {catalog
                    .filter(
                      (d) =>
                        d.state === "active" || relations.some((r) => r.discipline_id === d.id),
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
                <Label htmlFor="person-discipline-state">{t("disciplineState")}</Label>
                <select
                  id="person-discipline-state"
                  value={state}
                  onChange={(e) => setState(e.target.value === "active" ? "active" : "inactive")}
                  disabled={busy}
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  <option value="active">{t("states.active")}</option>
                  <option value="inactive">{t("states.inactive")}</option>
                </select>
                <Button disabled={busy || !selected}>{t("disciplineSave")}</Button>
              </>
            )}
          </form>
        )
      )}
    </section>
  );
}
