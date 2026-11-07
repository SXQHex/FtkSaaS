import { expect, test, vi, beforeEach } from "vitest";
import { v7 } from "uuid";
import { accountCall } from "../src/lib/account";
import {
  validCalendarCommand,
  calendarStorageKey,
  readCalendarPending,
  personalCalendarApi,
} from "../src/lib/personal-calendar";
vi.mock("../src/lib/account", () => ({ accountCall: vi.fn<typeof accountCall>() }));
const actor = v7(),
  org = v7(),
  id = v7(),
  command = {
    operation: "calendar_link_rotate_v1",
    input: {
      operation_key: v7(),
      organization_scope: { org_id: org },
      link_id: id,
      expected_version: 3,
    },
  } as const;
beforeEach(() => sessionStorage.clear());
test("calendar journal stores a scoped command without a subscription URL and isolates actors", () => {
  sessionStorage.setItem(calendarStorageKey(actor), JSON.stringify(command));
  expect(readCalendarPending(actor)).toEqual(command);
  expect(readCalendarPending(v7())).toBeNull();
  expect(sessionStorage.getItem(calendarStorageKey(actor))).not.toContain("subscription_url");
});
test.each([
  { ...command, input: { ...command.input, expected_version: 0 } },
  {
    ...command,
    input: { ...command.input, subscription_url: "https://example.invalid/private.ics" },
  },
  { ...command, input: { ...command.input, organization_scope: { org_id: "account-id" } } },
  { ...command, operation: "organization_delete_apply_v1" },
])("rejects malformed or unrelated calendar commands", (c) => {
  expect(validCalendarCommand(c)).toBe(false);
});
test("native calendar mutation rejects a foreign link or organization", async () => {
  const link = {
    id,
    org_id: v7(),
    kinds: ["duties"],
    state: "active",
    version: 4,
    created_at: "2026-11-07T00:00:00Z",
  };
  vi.mocked(accountCall).mockResolvedValueOnce({
    primary_id: actor,
    link,
    subscription_url: "https://calendar.example.invalid/private.ics",
  } as never);
  await expect(personalCalendarApi.write(command, actor)).rejects.toThrow("invalidCalendarLinks");
});
test("missing credential URL does not become a successful create/rotate result", async () => {
  const link = {
    id,
    org_id: org,
    kinds: ["duties"],
    state: "active",
    version: 4,
    created_at: "2026-11-07T00:00:00Z",
  };
  vi.mocked(accountCall).mockResolvedValueOnce({ primary_id: actor, link } as never);
  await expect(personalCalendarApi.write(command, actor)).rejects.toThrow("invalidCalendarLinks");
});
test("own links can still be read when feed service is not configured", async () => {
  const page = {
    items: [],
    as_of: "2026-11-07T00:00:00Z",
    next_cursor: null,
    service_ready: false,
    supported_kinds: [],
  };
  vi.mocked(accountCall).mockResolvedValueOnce(page as never);
  expect(await personalCalendarApi.list()).toEqual(page);
  expect(accountCall).toHaveBeenLastCalledWith("calendar_links_get_v1", {
    page: { limit: 25, sort: "created_at_asc" },
  });
});
test("real account-receipt semantics accept own account primary_id distinct from the link id", async () => {
  const link = {
    id,
    org_id: org,
    kinds: ["duties"],
    state: "active",
    version: 4,
    created_at: "2026-11-07T00:00:00Z",
  };
  vi.mocked(accountCall).mockResolvedValueOnce({
    primary_id: actor,
    link,
    subscription_url: "https://calendar.example.invalid/private.ics",
  } as never);
  const result = await personalCalendarApi.write(command, actor);
  expect(result.primary_id).toBe(actor);
  expect(result.link.id).toBe(id);
  expect(id).not.toBe(actor);
});
