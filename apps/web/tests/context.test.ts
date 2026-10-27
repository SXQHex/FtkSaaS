import { expect, test } from "vitest";
import type { CenterView, OrganizationView } from "@ftksaas/api-contracts";
import { accessibleCenters, preferredContext, readRememberedContext } from "../src/lib/context";
const organizations: OrganizationView[] = [
  { id: "org-a", name: "A", state: "active", access_mode: "normal", version: 1 },
];
test("fixed startup context never overrides remembered context when remembering is enabled", () => {
  const remembered = { org_id: "org-a", center_id: "center-a", discipline_id: null };
  const fixed = { org_id: "org-a", center_id: "center-b", discipline_id: null };
  expect(
    preferredContext({ remember_context: true, startup_context: fixed }, remembered, organizations),
  ).toEqual(remembered);
  expect(
    preferredContext(
      { remember_context: false, startup_context: fixed },
      remembered,
      organizations,
    ),
  ).toEqual(fixed);
  expect(
    preferredContext(
      { remember_context: true },
      { ...remembered, org_id: "inaccessible" },
      organizations,
    ),
  ).toBeNull();
  expect(
    preferredContext({ remember_context: false, startup_context: fixed }, null, [
      { ...organizations[0], access_mode: "closed" },
    ]),
  ).toBeNull();
});
test("corrupt saved state and inaccessible centers cannot become the working context", () => {
  for (const value of [
    "broken",
    "[]",
    "null",
    '{"org_id":42}',
    '{"org_id":"a","center_id":4,"discipline_id":null}',
  ])
    expect(readRememberedContext(value)).toBeNull();
  const centers: CenterView[] = [
    {
      id: "a",
      name: "A",
      timezone: "Europe/Istanbul",
      state: "active",
      accessible: true,
      version: 1,
    },
  ];
  expect(
    accessibleCenters([
      ...centers,
      { ...centers[0], id: "b", accessible: false },
      { ...centers[0], id: "c", state: "inactive" },
    ]),
  ).toEqual(centers);
});
