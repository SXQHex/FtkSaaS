import { test, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { WorkspaceScope } from "../src/components/workspace-scope";
import { UserPreferencesProvider } from "../src/components/user-preferences";
import { contextStorageKey } from "../src/lib/context";
const actor = v7(),
  org = v7(),
  center = v7();
const studios = [
  {
    organization: {
      id: org,
      name: "Studio",
      state: "active" as const,
      access_mode: "normal" as const,
      version: 1,
    },
    centers: [
      {
        id: center,
        name: "Center",
        timezone: "Europe/Istanbul",
        state: "active" as const,
        accessible: true,
        version: 1,
      },
    ],
  },
];
beforeEach(() => localStorage.clear());
test("an explicit empty startup preference requires a native center choice and does not persist it when remembering is off", async () => {
  render(
    <UserPreferencesProvider value={{ remember_context: false, startup_context: null }}>
      <WorkspaceScope actorId={actor} studios={studios}>
        {(scope) => <output>{scope.centerId}</output>}
      </WorkspaceScope>
    </UserPreferencesProvider>,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox"), `${org}:${center}`);
  expect(screen.getByRole("status")).toHaveTextContent(center);
  expect(localStorage.getItem(contextStorageKey(actor))).toBeNull();
});
test("the remembered context cannot select a foreign inaccessible center", () => {
  localStorage.setItem(
    contextStorageKey(actor),
    JSON.stringify({ org_id: org, center_id: v7(), discipline_id: null }),
  );
  render(
    <UserPreferencesProvider value={{ remember_context: true }}>
      <WorkspaceScope actorId={actor} studios={studios}>
        {(scope) => <output>{scope.centerId}</output>}
      </WorkspaceScope>
    </UserPreferencesProvider>,
  );
  expect(screen.getByRole("status")).toHaveTextContent(center);
});
