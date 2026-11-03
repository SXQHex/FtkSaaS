import { expect, test } from "vitest";
import { screen, within } from "@testing-library/react";
import type { Preview } from "@ftksaas/api-contracts";
import { render } from "./render";
import { ScheduleConfiguration } from "../src/components/programs/schedule-configuration";

const preview: Preview = {
  id: "019a2b3c-4d5e-7000-8000-000000000003",
  token: "synthetic",
  dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
  scope_hash: "synthetic",
  effects: [],
  blockers: [{ code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: "synthetic" }],
  expires_at: "2099-01-01T00:00:00Z",
  configuration_requirement: {
    blocker_index: 0,
    kind: "instructor_agreement",
    person_id: "person-affected",
    discipline_id: "discipline-affected",
    format: "private",
    starts_at: "2030-01-01T21:30:00Z",
  },
};

test("a generic policy blocker does not invent an instructor agreement diagnosis", () => {
  render(
    <ScheduleConfiguration
      preview={{ ...preview, configuration_requirement: undefined }}
      timeZone="Europe/Istanbul"
    />,
  );
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("the typed diagnosis shows the affected occurrence and exact matching catalog names", () => {
  render(
    <ScheduleConfiguration
      preview={preview}
      timeZone="Europe/Istanbul"
      people={[{ id: "person-affected", name: "İlgili eğitmen" }]}
      disciplines={[{ id: "discipline-affected", name: "Tango" }]}
    />,
  );
  const region = screen.getByRole("region", { name: "Eğitmen anlaşması doğrulanamadı" });
  expect(region).toHaveTextContent("İlgili eğitmen");
  expect(region).toHaveTextContent("Tango");
  expect(region).toHaveTextContent("Özel ders");
  expect(region).toHaveTextContent("2 Ocak 2030");
  expect(region).toHaveTextContent("00:30");
  expect(region).toHaveTextContent("Europe/Istanbul");
  expect(region).toHaveTextContent("ilk");
  expect(region).toHaveTextContent("yeni bir önizleme");
  expect(within(region).queryByRole("button")).not.toBeInTheDocument();
  expect(within(region).queryByRole("link")).not.toBeInTheDocument();
});

test("unknown references stay identifiable and never borrow another person's name", () => {
  render(
    <ScheduleConfiguration
      preview={preview}
      timeZone="UTC"
      people={[{ id: "different", name: "Başka eğitmen" }]}
      disciplines={[{ id: "different", name: "Başka disiplin" }]}
    />,
  );
  const region = screen.getByRole("region");
  expect(region).toHaveTextContent("person-affected");
  expect(region).toHaveTextContent("discipline-affected");
  expect(region).not.toHaveTextContent("Başka eğitmen");
  expect(region).not.toHaveTextContent("Başka disiplin");
});

test("a diagnostic must refer to a policy blocker, not a resource conflict", () => {
  render(
    <ScheduleConfiguration
      preview={{
        ...preview,
        blockers: [{ code: "RESOURCE_CONFLICT", retryable: false, trace_id: "synthetic" }],
      }}
      timeZone="UTC"
    />,
  );
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

test("English group diagnosis uses the occurrence timezone and explains limited scope", () => {
  render(
    <ScheduleConfiguration
      preview={{
        ...preview,
        configuration_requirement: { ...preview.configuration_requirement!, format: "group" },
      }}
      timeZone="UTC"
    />,
    "en",
  );
  const region = screen.getByRole("region", { name: "Instructor agreement could not be verified" });
  expect(region).toHaveTextContent("Group class");
  expect(region).toHaveTextContent("January 1, 2030");
  expect(region).toHaveTextContent("21:30");
  expect(region).toHaveTextContent("first");
  expect(region).toHaveTextContent("new preview");
});
