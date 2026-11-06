"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import type { DutyInput, SessionCapacity, SessionFormat } from "@ftksaas/api-contracts";
import type { SetupScope } from "../../lib/studio-setup";
import { sessionAssignments, sessionCapacity, sessionInterval } from "../../lib/session-create";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { LocalTimeField } from "./local-time-field";
import { AdditionalDuties } from "./additional-duties";
import { CapacityFields } from "./capacity-fields";
import type { ClassValues, NamedOption } from "./class-form";
import type { ProgramCatalog } from "./program-form";
export function SingleSessionForm({
  scope,
  timeZone,
  catalog,
  classes,
  onSaved,
}: {
  scope: SetupScope;
  timeZone: string;
  catalog: ProgramCatalog;
  classes: ClassValues[];
  onSaved: () => void;
}) {
  const t = useTranslations("program");
  const [classId, setClassId] = useState(""),
    [disciplineId, setDisciplineId] = useState("");
  const [format, setFormat] = useState<SessionFormat | "">("");
  const [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [fromChoice, setFromChoice] = useState(""),
    [toChoice, setToChoice] = useState("");
  const [roomId, setRoomId] = useState(""),
    [personId, setPersonId] = useState("");
  const [extras, setExtras] = useState<DutyInput[]>([]);
  const [inherit, setInherit] = useState(false),
    [total, setTotal] = useState(NaN);
  const [categories, setCategories] = useState<SessionCapacity["categories"]>(null);
  const [error, setError] = useState("");
  const command = useSetupCommand(scope, "session:new", onSaved);
  const selected = classes.find((c) => c.id === classId);
  function select(
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: NamedOption[],
    required = true,
    disabled = false,
  ) {
    return (
      <label className="block min-w-0 space-y-2 text-sm">
        <span>{t(label)}</span>
        <select
          className="min-h-11 w-full rounded-md border bg-background px-3"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t(label === "sessionClass" ? "standalone" : "choose")}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <form
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const discipline = selected?.discipline_id ?? disciplineId;
          if (
            !format ||
            !discipline ||
            !roomId ||
            (!inherit && !personId) ||
            (inherit && !selected) ||
            (classId && !selected)
          )
            throw Error("invalidForm");
          const interval = sessionInterval(start, end, timeZone, fromChoice, toChoice);
          const capacity = sessionCapacity(total, categories);
          setError("");
          void command.run({
            operation: "session_create_v1",
            input: {
              org_id: scope.orgId,
              center_id: scope.centerId,
              operation_key: v7(),
              ...(classId ? { class_id: classId } : {}),
              discipline_id: discipline,
              format,
              interval,
              resources: [{ kind: "room", id: roomId }],
              assignments: inherit ? [] : sessionAssignments(personId, extras),
              capacity,
              inherit_class_assignments: inherit,
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
    >
      <p className="text-sm text-muted-foreground">{t("timezone", { timezone: timeZone })}</p>
      {error && <p role="alert">{t(error)}</p>}
      <fieldset disabled={command.busy || !!command.pending} className="min-w-0 space-y-5">
        <legend className="sr-only">{t("createSession")}</legend>
        {select(
          "sessionClass",
          classId,
          (id) => {
            setClassId(id);
            setInherit(false);
          },
          classes,
          false,
        )}
        {!selected && select("discipline", disciplineId, setDisciplineId, catalog.disciplines)}
        {select("format", format, (value) => setFormat(value as SessionFormat | ""), [
          { id: "group", name: t("group") },
          { id: "private", name: t("private") },
        ])}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <LocalTimeField
            label={t("sessionStart")}
            value={start}
            choice={fromChoice}
            timeZone={timeZone}
            onChange={setStart}
            onChoice={setFromChoice}
          />
          <LocalTimeField
            label={t("sessionEnd")}
            value={end}
            choice={toChoice}
            timeZone={timeZone}
            onChange={setEnd}
            onChoice={setToChoice}
          />
        </div>
        {select("room", roomId, setRoomId, catalog.rooms)}
        {selected && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={inherit}
              onChange={(e) => setInherit(e.target.checked)}
            />
            {t("inheritDuties")}
          </label>
        )}
        {select(
          "instructor",
          personId,
          (value) => {
            setPersonId(value);
            setExtras((current) =>
              current.filter((a) => !(a.person_id === value && a.duty === "instructor")),
            );
          },
          catalog.instructors,
          !inherit,
          inherit,
        )}
        {!inherit && (
          <AdditionalDuties
            people={catalog.duties ?? []}
            primaryId={personId}
            value={extras}
            onChange={setExtras}
          />
        )}
        <CapacityFields
          total={total}
          categories={categories}
          onChange={(count, limits) => {
            setTotal(count);
            setCategories(limits);
          }}
        />
        <Button type="submit">{t("createSession")}</Button>
      </fieldset>
      <SetupFeedback command={command} />
    </form>
  );
}
