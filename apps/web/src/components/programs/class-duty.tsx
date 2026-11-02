"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { Duty } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { assignmentVersion } from "../../lib/session-create";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, errorKey, useSetupCommand } from "../setup/setup-command";
import type { NamedOption } from "./class-form";
export type DutyOption = NamedOption & { duty: Duty };
export function ClassDuty({
  scope,
  classId,
  people,
  onSaved,
}: {
  scope: SetupScope;
  classId: string;
  people: DutyOption[];
  onSaved: () => void;
}) {
  const t = useTranslations("program");
  const [selected, setSelected] = useState("");
  const person = people.find((p) => `${p.id}:${p.duty}` === selected);
  return (
    <section className="space-y-4" aria-label={t("defaultDuties")}>
      <h3 className="font-semibold">{t("defaultDuties")}</h3>
      <p className="text-sm text-muted-foreground">{t("dutyImpact")}</p>
      <label className="block space-y-2 text-sm">
        <span>{t("dutyPerson")}</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-h-11 w-full rounded-md border bg-background px-3"
        >
          <option value="">{t("choose")}</option>
          {people.map((p) => (
            <option key={`${p.id}:${p.duty}`} value={`${p.id}:${p.duty}`}>
              {p.name} — {t(p.duty)}
            </option>
          ))}
        </select>
      </label>
      {person && (
        <DutyEditor
          key={`${scope.actorId}:${scope.orgId}:${scope.centerId}:${classId}:${selected}`}
          scope={scope}
          classId={classId}
          person={person}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
function DutyEditor({
  scope,
  classId,
  person,
  onSaved,
}: {
  scope: SetupScope;
  classId: string;
  person: DutyOption;
  onSaved: () => void;
}) {
  const t = useTranslations("program"),
    errors = useTranslations("setup");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    value?: ReturnType<typeof assignmentVersion>;
    error?: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const command = useSetupCommand(
    scope,
    `class-duty:${classId}:${person.id}:${person.duty}`,
    () => {
      setConfirmed(false);
      setAttempt((n) => n + 1);
      onSaved();
    },
  );
  useEffect(() => {
    let active = true;
    void setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "class_assignment_set_v1",
      selector: {
        operation: "class_assignment_set_v1",
        key: { class_id: classId, person_id: person.id, duty: person.duty },
      },
      page: { limit: 1, sort: "created_at_asc" },
    })
      .then((page) => {
        if (page.items.length !== 1) throw Error("unreadableAssignment");
        const value = assignmentVersion(page.items[0], classId, person.id, person.duty);
        if (active) setResult({ attempt, value });
      })
      .catch((cause) => {
        if (active) setResult({ attempt, error: errorKey(setupError(cause)) });
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, classId, person.id, person.duty, attempt]);
  const current = result?.attempt === attempt ? result : null;
  return (
    <div className="space-y-3">
      {!current && <output aria-live="polite">{t("loading")}</output>}
      {current?.error && <p role="alert">{errors(current.error)}</p>}
      {current?.value && (
        <>
          <p className="text-sm">
            {t(current.value.state === "active" ? "dutyActive" : "dutyInactive")}
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={command.busy || !!command.pending}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t("confirmDutyImpact")}
          </label>
          <Button
            className="transition-colors"
            disabled={!confirmed || command.busy || !!command.pending}
            onClick={() =>
              void command.run({
                operation: "class_assignment_set_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  class_id: classId,
                  person_id: person.id,
                  duty: person.duty,
                  state: current.value!.state === "active" ? "inactive" : "active",
                  ...(current.value!.version ? { expected_version: current.value!.version } : {}),
                },
              })
            }
          >
            {t(current.value.state === "active" ? "removeDuty" : "addDuty")}
          </Button>
        </>
      )}
      <Button
        variant="outline"
        disabled={command.busy || !!command.pending}
        onClick={() => {
          setConfirmed(false);
          setAttempt((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      <SetupFeedback command={command} />
    </div>
  );
}
