import { beforeEach, expect, it, vi } from "vitest";
import type { PersonView } from "../../lib/api-contracts/generated";
import {
  prepareStudentDiscipline,
  writeStudentDiscipline,
  studentDisciplineReceipt,
  readStudentDisciplineResult,
} from "./student-discipline";
const { personRead, disciplinesRead, call } = vi.hoisted(() => ({
  personRead: vi.fn(),
  disciplinesRead: vi.fn(),
  call: vi.fn(),
}));
vi.mock("../people/people", () => ({ readPerson: personRead }));
vi.mock("./profile-read", () => ({ readProfileDisciplines: disciplinesRead }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  discipline = { id: id(4), name: "Tango", state: "active" };
let person: PersonView;
beforeEach(() => {
  person = {
    id: id(5),
    display_name: "Sentetik öğrenci",
    version: 3,
    relationships: [{ center_id: scope.centerId, kind: "student", state: "active" }],
    discipline_relationships: [
      {
        center_id: scope.centerId,
        discipline_id: discipline.id,
        kind: "instructor",
        state: "active",
        version: 2,
      },
      {
        center_id: id(9),
        discipline_id: discipline.id,
        kind: "student",
        state: "inactive",
        version: 8,
      },
    ],
  };
  personRead.mockReset().mockImplementation(async () => structuredClone(person));
  disciplinesRead.mockReset().mockResolvedValue([discipline]);
  call.mockReset().mockResolvedValue({ primary_id: id(6) });
});
it("prepares an explicit new student link and pins its scope/key without borrowing instructor or another center's version", async () => {
  const intent = await prepareStudentDiscipline(scope, person.id, discipline.id, "active");
  expect(intent.version).toBeUndefined();
  expect(intent.beforeState).toBeNull();
  await writeStudentDiscipline(intent);
  await writeStudentDiscipline(intent);
  expect(call.mock.calls[0]![1]).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    person_id: person.id,
    discipline_id: discipline.id,
    kind: "student",
    state: "active",
    operation_key: intent.key,
  });
  expect(call.mock.calls[0]![1]).not.toHaveProperty("expected_version");
  expect(call.mock.calls[1]![1].operation_key).toBe(intent.key);
  expect(call.mock.calls[1]![1].request_id).not.toBe(call.mock.calls[0]![1].request_id);
});
it("updates only the native student relation version and requires a newer matching result", async () => {
  person.discipline_relationships.push({
    center_id: scope.centerId,
    discipline_id: discipline.id,
    kind: "student",
    state: "active",
    version: 3,
  });
  const intent = await prepareStudentDiscipline(scope, person.id, discipline.id, "inactive");
  await writeStudentDiscipline(intent);
  expect(call.mock.calls[0]![1].expected_version).toBe(3);
  await expect(readStudentDisciplineResult(intent)).rejects.toThrow(
    "STUDENT_DISCIPLINE_RESULT_UNAVAILABLE",
  );
  person.discipline_relationships[2]!.state = "inactive";
  person.discipline_relationships[2]!.version = 4;
  await expect(readStudentDisciplineResult(intent)).resolves.toMatchObject({
    discipline_relationships: person.discipline_relationships,
  });
  expect(person.discipline_relationships[0]!.version).toBe(2);
  expect(person.discipline_relationships[1]!.version).toBe(8);
});
it("does not activate a student discipline for an inactive student or retired/missing discipline", async () => {
  person.relationships[0]!.state = "inactive";
  await expect(prepareStudentDiscipline(scope, person.id, discipline.id, "active")).rejects.toThrow(
    "STUDENT_DISCIPLINE_SOURCE_UNAVAILABLE",
  );
  person.relationships[0]!.state = "active";
  disciplinesRead.mockResolvedValue([{ ...discipline, state: "inactive" }]);
  await expect(prepareStudentDiscipline(scope, person.id, discipline.id, "active")).rejects.toThrow(
    "STUDENT_DISCIPLINE_SOURCE_UNAVAILABLE",
  );
  disciplinesRead.mockResolvedValue([]);
  await expect(
    prepareStudentDiscipline(scope, person.id, discipline.id, "inactive"),
  ).rejects.toThrow("STUDENT_DISCIPLINE_SOURCE_UNAVAILABLE");
  expect(call).not.toHaveBeenCalled();
});
it("treats an unchanged state as no change and rejects ambiguous native relations", async () => {
  const row = {
    center_id: scope.centerId,
    discipline_id: discipline.id,
    kind: "student" as const,
    state: "active" as const,
    version: 3,
  };
  person.discipline_relationships.push(row);
  await expect(prepareStudentDiscipline(scope, person.id, discipline.id, "active")).rejects.toThrow(
    "STUDENT_DISCIPLINE_NO_CHANGE",
  );
  person.discipline_relationships.push({ ...row, version: 4 });
  await expect(
    prepareStudentDiscipline(scope, person.id, discipline.id, "inactive"),
  ).rejects.toThrow("STUDENT_DISCIPLINE_SOURCE_UNAVAILABLE");
  expect(call).not.toHaveBeenCalled();
});
it("checks operation/key/entity on the receipt without accepting a student-center activation receipt", async () => {
  const intent = await prepareStudentDiscipline(scope, person.id, discipline.id, "active");
  call.mockResolvedValue({
    operation: "person_discipline_set_v1",
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "person_disciplines", id: id(6) },
  });
  await expect(studentDisciplineReceipt(intent)).resolves.toMatchObject({ status: "succeeded" });
  call.mockResolvedValue({
    operation: "person_discipline_set_v1",
    key: intent.key,
    result_reference: { type: "center_relationships", id: id(6) },
  });
  await expect(studentDisciplineReceipt(intent)).rejects.toThrow(
    "STUDENT_DISCIPLINE_RECEIPT_UNAVAILABLE",
  );
});
it("rejects an unchanged version even when the returned target state looks correct", async () => {
  person.discipline_relationships.push({
    center_id: scope.centerId,
    discipline_id: discipline.id,
    kind: "student",
    state: "active",
    version: 3,
  });
  const intent = await prepareStudentDiscipline(scope, person.id, discipline.id, "inactive");
  person.discipline_relationships[2]!.state = "inactive";
  await expect(readStudentDisciplineResult(intent)).rejects.toThrow(
    "STUDENT_DISCIPLINE_RESULT_UNAVAILABLE",
  );
});
