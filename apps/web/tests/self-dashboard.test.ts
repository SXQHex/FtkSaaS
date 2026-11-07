import { expect, test, vi } from "vitest";
import { v7 } from "uuid";
import { selfChoices, readSelfReservations } from "../src/lib/self-dashboard";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const org = v7(),
  person = v7(),
  center = v7();
test("native self context is the only identity source, scoped to accessible active centers", () => {
  const studios = [
    {
      organization: {
        id: org,
        access_mode: "normal",
        self_context: {
          person_id: person,
          subscriber_number: 1061,
          centers: [{ center_id: center, student: true, instructor: false, assistant: false }],
        },
      },
      centers: [{ id: center, accessible: true, state: "active" }],
    },
  ];
  expect(selfChoices(studios as never)[0]).toMatchObject({
    personId: person,
    subscriberNumber: 1061,
    centerId: center,
    student: true,
    instructor: false,
  });
  expect(
    selfChoices([
      { ...studios[0], organization: { ...studios[0].organization, self_context: null } },
    ] as never),
  ).toEqual([]);
  expect(
    selfChoices([
      { ...studios[0], centers: [{ id: center, accessible: false, state: "active" }] },
    ] as never),
  ).toEqual([]);
});
test("self reservation page rejects another person's data instead of showing or inferring ownership", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({
    items: [{ id: v7(), person_id: v7() }],
    next_cursor: null,
  } as never);
  await expect(
    readSelfReservations({ actorId: v7(), orgId: org, centerId: center }, person),
  ).rejects.toThrow("invalidSelf");
});
