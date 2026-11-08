"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { SessionCapacity, SessionView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { getProgramCatalog } from "../../lib/program";
import { sessionCapacity, sessionInterval } from "../../lib/session-create";
import { type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { CapacityFields } from "../programs/capacity-fields";
import { LocalTimeField } from "../programs/local-time-field";
export function ReplacementSession({
  scope,
  source,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  source: SessionView;
  timeZone: string;
  onSaved: (createdId?: string) => void;
}) {
  const t = useTranslations("sessionLifecycle"),
    program = useTranslations("program"),
    format = useFormatter();
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [fromChoice, setFromChoice] = useState(""),
    [toChoice, setToChoice] = useState("");
  const [room, setRoom] = useState(""),
    [total, setTotal] = useState(NaN),
    [categories, setCategories] = useState<SessionCapacity["categories"]>(null),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0),
    [result, setResult] = useState<{
      key: string;
      rooms?: { id: string; name: string }[];
      failed?: boolean;
    } | null>(null);
  const key = `${scope.actorId}:${scope.orgId}:${scope.centerId}:${attempt}`;
  const [finished, setFinished] = useState(false);
  const command = useSetupCommand(scope, `replacement:${source.id}`, (createdId) => {
    setFinished(true);
    onSaved(createdId);
  });
  useEffect(() => {
    if (source.state !== "cancelled") return;
    let active = true;
    void getProgramCatalog({ actorId: scope.actorId, orgId: scope.orgId, centerId: scope.centerId })
      .then((catalog) => {
        if (active) setResult({ key, rooms: catalog.rooms });
      })
      .catch(() => {
        if (active) setResult({ key, failed: true });
      });
    return () => {
      active = false;
    };
  }, [scope.actorId, scope.orgId, scope.centerId, source.state, key]);
  const current = result?.key === key ? result : null;
  const disabled = command.busy || !!command.pending || !current?.rooms;
  if (source.state !== "cancelled") return <p role="alert">{t("replacementUnavailable")}</p>;
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm font-medium">
        {t("replacementSource", {
          date: format.dateTime(new Date(source.starts_at), {
            timeZone,
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      </p>
      <p className="text-sm text-muted-foreground">{t("replacementHint")}</p>
      <p className="text-sm text-muted-foreground">{program("timezone", { timezone: timeZone })}</p>
      {!current && <output aria-live="polite">{program("loading")}</output>}
      {current?.failed && (
        <div role="alert" className="space-y-3">
          <p>{t("resourcesUnavailable")}</p>
          <Button
            variant="outline"
            disabled={command.busy}
            onClick={() => setAttempt((n) => n + 1)}
          >
            {program("refresh")}
          </Button>
        </div>
      )}
      {error && <p role="alert">{program(error)}</p>}
      {!finished && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (disabled || !confirmed) return;
            try {
              if (!room || !current?.rooms?.some((r) => r.id === room)) throw Error("invalidForm");
              const interval = sessionInterval(start, end, timeZone, fromChoice, toChoice),
                capacity = sessionCapacity(total, categories);
              setError("");
              void command.run({
                operation: "replacement_session_create_v1",
                input: {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  operation_key: v7(),
                  replaces_id: source.id,
                  interval,
                  resources: [{ kind: "room", id: room }],
                  capacity,
                },
              });
            } catch (cause) {
              setError(
                cause instanceof Error &&
                  ["invalidForm", "chooseOffsets", "nonexistentTime"].includes(cause.message)
                  ? cause.message
                  : "invalidForm",
              );
            }
          }}
          className="space-y-4"
        >
          <fieldset disabled={disabled} className="min-w-0 space-y-4">
            <legend className="sr-only">{t("replacementTitle")}</legend>
            <LocalTimeField
              label={program("sessionStart")}
              value={start}
              choice={fromChoice}
              timeZone={timeZone}
              onChange={setStart}
              onChoice={setFromChoice}
            />
            <LocalTimeField
              label={program("sessionEnd")}
              value={end}
              choice={toChoice}
              timeZone={timeZone}
              onChange={setEnd}
              onChoice={setToChoice}
            />
            <label className="block space-y-2 text-sm">
              <span>{program("room")}</span>
              <select
                required
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="min-h-11 w-full rounded-md border bg-background px-3"
              >
                <option value="">{program("choose")}</option>
                {current?.rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <CapacityFields
              total={total}
              categories={categories}
              onChange={(count, limits) => {
                setTotal(count);
                setCategories(limits);
              }}
            />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {t("replacementConfirm")}
            </label>
            <Button
              type="submit"
              disabled={!confirmed}
              className="h-auto min-h-11 whitespace-normal transition-colors"
            >
              {t("replacementCreate")}
            </Button>
          </fieldset>
        </form>
      )}
      <SetupFeedback command={command} />
    </div>
  );
}
