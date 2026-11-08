"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { RoleView, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Label } from "@ftksaas/ui/components/label";
import { getInstructorTasks, getSetupRoles } from "../../lib/instructor-setup";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey, SetupFeedback, useSetupCommand } from "./setup-command";

type Instructor = { role: RoleView; name: string };
function RepairSession({
  scope,
  initial,
  instructors,
  onSaved,
}: {
  scope: SetupScope;
  initial: SessionView;
  instructors: Instructor[];
  onSaved: () => void;
}) {
  const t = useTranslations("setup"),
    format = useFormatter();
  const [session, setSession] = useState<SessionView | null>(null),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  const command = useSetupCommand(scope, `session-instructor:${initial.id}`, onSaved);
  useEffect(() => {
    if (!attempt) return;
    let active = true;
    void setupCall("session_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      session_id: initial.id,
    })
      .then((result) => {
        if (result.id !== initial.id) throw new Error("Mismatched session");
        if (active) {
          if (result.management_attention !== "instructor_required") {
            onSaved();
            return;
          }
          setSession(result);
        }
      })
      .catch((cause) => {
        if (active) setError(errorKey(setupError(cause)));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, scope.orgId, scope.centerId, initial.id, onSaved]);
  return (
    <li className="space-y-4 py-4">
      <p className="font-medium">
        <time dateTime={initial.starts_at}>
          {format.dateTime(new Date(initial.starts_at), {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
        {" – "}
        <time dateTime={initial.ends_at}>
          {format.dateTime(new Date(initial.ends_at), { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy || command.busy || !!command.pending}
        onClick={() => {
          setBusy(true);
          setSession(null);
          setError("");
          setAttempt((n) => n + 1);
        }}
      >
        {t("inspectSession")}
      </Button>
      {busy && <output aria-live="polite">{t("loading")}</output>}
      {error && <p role="alert">{t(error)}</p>}
      {session && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const personId = String(new FormData(event.currentTarget).get("instructor"));
            if (!instructors.some((entry) => entry.role.person_id === personId)) return;
            void command.run({
              operation: "session_assignment_set_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                session_id: session.id,
                expected_version: session.version,
                person_id: personId,
                duty: "instructor",
              },
            });
          }}
        >
          <Label htmlFor={`session-instructor-${initial.id}`}>{t("replacementInstructor")}</Label>
          <select
            id={`session-instructor-${initial.id}`}
            name="instructor"
            required
            defaultValue=""
            disabled={command.busy || !!command.pending}
            className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              {t("choosePerson")}
            </option>
            {instructors.map((entry) => (
              <option key={entry.role.id} value={entry.role.person_id}>
                {entry.name}
              </option>
            ))}
          </select>
          <Button disabled={command.busy || !!command.pending || !instructors.length}>
            {t("assignSessionInstructor")}
          </Button>
        </form>
      )}
      <SetupFeedback command={command} />
    </li>
  );
}
export function InstructorTasks({ scope, centerName }: { scope: SetupScope; centerName: string }) {
  const t = useTranslations("setup");
  const [sessions, setSessions] = useState<SessionView[] | null>(null),
    [instructors, setInstructors] = useState<Instructor[]>([]),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [excluded, setExcluded] = useState(false);
  const refresh = useCallback(() => {
    setSessions(null);
    setError("");
    setRetry((n) => n + 1);
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      const plan = await setupCall("subscription_get_v1", { org_id: scope.orgId });
      if (plan.plan !== "starter") {
        if (active) setExcluded(true);
        return;
      }
      const rows = await getInstructorTasks({ orgId: scope.orgId, centerId: scope.centerId });
      const tasks = rows.map((row) => {
        const session = row.session_detail;
        const version = row.versions.find(
          (v) => v.entity.type === "sessions" && v.entity.id === row.entity?.id,
        )?.version;
        if (
          row.operation !== "session_assignment_set_v1" ||
          row.entity?.type !== "sessions" ||
          !row.exists ||
          row.management_attention !== "instructor_required" ||
          !session ||
          session.id !== row.entity.id ||
          session.version !== version
        )
          throw new Error("Unreadable session task");
        return session;
      });
      const roles = tasks.length
        ? await getSetupRoles({ orgId: scope.orgId, centerId: scope.centerId })
        : [];
      const people = await Promise.all(
        roles
          .filter(
            (role) =>
              role.state === "active" &&
              role.role === "instructor" &&
              role.scope_center_id === scope.centerId,
          )
          .map(async (role) => {
            const person = await setupCall("person_get_v1", {
              org_id: scope.orgId,
              center_id: scope.centerId,
              person_id: role.person_id,
            });
            return { role, name: person.display_name };
          }),
      );
      if (active) {
        setSessions(tasks);
        setInstructors(people);
      }
    }
    void load().catch((cause) => {
      if (active) {
        setSessions(null);
        setInstructors([]);
        setError(errorKey(setupError(cause)));
      }
    });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, retry]);
  if (excluded || error === "FORBIDDEN") return null;
  return (
    <section
      className="mb-6 min-w-0 space-y-4 rounded-lg border p-4 [&_button]:h-auto [&_button]:min-h-9 [&_button]:whitespace-normal [&_fieldset]:min-w-0"
      aria-label={t("instructorTasks", { center: centerName })}
    >
      <h2 className="text-lg font-semibold">{t("instructorTasks", { center: centerName })}</h2>
      <p className="text-sm text-muted-foreground">{t("removalPreservesSessions")}</p>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setSessions(null);
          setError("");
          setRetry((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!sessions && !error && <output aria-live="polite">{t("loading")}</output>}
      {sessions?.length === 0 && <p>{t("noInstructorTasks")}</p>}
      {sessions && sessions.length > 0 && (
        <ul className="divide-y">
          {sessions.map((session) => (
            <RepairSession
              key={`${scope.actorId}:${session.id}:${session.version}:${retry}`}
              scope={scope}
              initial={session}
              instructors={instructors}
              onSaved={refresh}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
