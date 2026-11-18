import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { readPerson } from "../people/people";
import { readProfileDisciplines } from "./profile-read";

export type StudentDisciplineState = "active" | "inactive";
export async function prepareStudentDiscipline(
  scope: ClientScope,
  personId: string,
  disciplineId: string,
  state: StudentDisciplineState,
) {
  z.uuid().parse(personId);
  z.uuid().parse(disciplineId);
  z.enum(["active", "inactive"]).parse(state);
  const [person, disciplines] = await Promise.all([
    readPerson(scope, personId),
    readProfileDisciplines(scope),
  ]);
  const discipline = disciplines.find((row) => row.id === disciplineId);
  if (
    !discipline ||
    (state === "active" &&
      (discipline.state !== "active" ||
        discipline.presentation?.center?.state === "inactive" ||
        !person.relationships.some(
          (row) =>
            row.center_id === scope.centerId && row.kind === "student" && row.state === "active",
        )))
  )
    throw Error("STUDENT_DISCIPLINE_SOURCE_UNAVAILABLE");
  const rows = person.discipline_relationships.filter(
    (row) =>
      row.center_id === scope.centerId &&
      row.discipline_id === disciplineId &&
      row.kind === "student",
  );
  if (rows.length > 1) throw Error("STUDENT_DISCIPLINE_SOURCE_UNAVAILABLE");
  const before = rows[0];
  if (before) z.number().int().positive().safe().parse(before.version);
  if (before?.state === state) throw Error("STUDENT_DISCIPLINE_NO_CHANGE");
  return {
    scope: { ...scope },
    personId,
    disciplineId,
    disciplineName: discipline.name,
    name: person.display_name,
    state,
    beforeState: before?.state ?? null,
    version: before?.version,
    key: uuidv7(),
  };
}
export type StudentDisciplineIntent = Awaited<ReturnType<typeof prepareStudentDiscipline>>;
const common = (intent: StudentDisciplineIntent) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: intent.scope.orgId,
  center_id: intent.scope.centerId,
});
export async function writeStudentDiscipline(intent: StudentDisciplineIntent) {
  return (await scopedBackend(intent.scope)).call("person_discipline_set_v1", {
    ...common(intent),
    operation_key: intent.key,
    person_id: intent.personId,
    discipline_id: intent.disciplineId,
    kind: "student",
    state: intent.state,
    ...(intent.version === undefined ? {} : { expected_version: intent.version }),
  });
}
export async function studentDisciplineReceipt(intent: StudentDisciplineIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: intent.scope.orgId,
    operation: "person_discipline_set_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "person_discipline_set_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "person_disciplines")
  )
    throw Error("STUDENT_DISCIPLINE_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readStudentDisciplineResult(intent: StudentDisciplineIntent) {
  const person = await readPerson(intent.scope, intent.personId);
  const rows = person.discipline_relationships.filter(
    (row) =>
      row.center_id === intent.scope.centerId &&
      row.discipline_id === intent.disciplineId &&
      row.kind === "student",
  );
  const version = rows[0]?.version;
  if (
    rows.length !== 1 ||
    rows[0]?.state !== intent.state ||
    !Number.isSafeInteger(version) ||
    version! <= (intent.version ?? 0)
  )
    throw Error("STUDENT_DISCIPLINE_RESULT_UNAVAILABLE");
  return person;
}
