import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { v7 } from "uuid";
import { render } from "./render";
import { server } from "./mocks/server";
import { LeadForm } from "../src/components/crm/lead-form";
import { ActivityForm } from "../src/components/crm/activity-form";
import { crmApi, type LeadRecord } from "../src/lib/crm";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() };
const person = v7();
const lead: LeadRecord = {
  id: v7(),
  person_id: person,
  source: "phone",
  interest: "Tango",
  assigned_to: null,
  state: "open",
  version: 3,
  subscriber_number: "1061",
};
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("subscriber number search selects the canonical person, with explicit lead approval and native reread callback", async () => {
  const people = vi.spyOn(crmApi, "people").mockResolvedValue({
    items: [{ id: person, display_name: "Synthetic Student", subscriber_number: "1061" }],
    as_of: "2026-11-07T00:00:00Z",
    next_cursor: null,
  } as never);
  const bodies: Record<string, unknown>[] = [],
    saved = vi.fn<() => void>(),
    user = userEvent.setup();
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/lead_save_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { primary_id: lead.id, operation_id: v7(), replayed: false, related: [] },
          trace_id: v7(),
        });
      },
    ),
  );
  render(<LeadForm scope={scope} onSaved={saved} />);
  await user.type(screen.getByRole("textbox", { name: "Ad veya Abone No ile kişi ara" }), "1061");
  await user.click(screen.getByRole("button", { name: "Ara" }));
  await waitFor(() => expect(people).toHaveBeenLastCalledWith(scope, "1061", undefined));
  await user.selectOptions(await screen.findByRole("combobox", { name: "Kişi seç" }), person);
  expect(screen.getByRole("option", { name: "Synthetic Student · 1061" })).toBeInTheDocument();
  await user.type(screen.getByLabelText("İlgi alanı"), "Salsa");
  await user.click(screen.getByRole("button", { name: "İncele" }));
  expect(bodies).toHaveLength(0);
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: "Gösterilen işlemi ve etkilerini onaylıyorum." }),
  );
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(bodies[0]).toMatchObject({
    person_id: person,
    org_id: scope.orgId,
    center_id: scope.centerId,
    interest: "Salsa",
  });
  expect(bodies[0]).not.toHaveProperty("subscriber_number");
  expect(bodies[0]).not.toHaveProperty("account_id");
  people.mockRestore();
});
test("ambiguous follow-up time requires an offset and writes the selected instant", async () => {
  const user = userEvent.setup(),
    bodies: Record<string, unknown>[] = [],
    saved = vi.fn<() => void>();
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/crm_activity_save_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { primary_id: v7(), operation_id: v7(), replayed: false, related: [] },
          trace_id: v7(),
        });
      },
    ),
  );
  render(<ActivityForm scope={scope} lead={lead} timeZone="America/New_York" onSaved={saved} />);
  await user.selectOptions(screen.getByRole("combobox", { name: "Tür" }), "followup");
  await user.type(screen.getByLabelText("Not"), "Call back");
  fireEvent.change(screen.getByLabelText("Takip zamanı"), {
    target: { value: "2026-11-01T01:30" },
  });
  const offset = screen.getAllByRole("combobox")[1]!;
  expect(offset).toBeRequired();
  expect(bodies).toHaveLength(0);
  await user.selectOptions(offset, "2026-11-01T06:30:00.000Z");
  await user.click(screen.getByRole("button", { name: "İncele" }));
  await user.click(
    screen.getByRole("checkbox", { name: "Gösterilen işlemi ve etkilerini onaylıyorum." }),
  );
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(bodies[0]).toMatchObject({
    lead_id: lead.id,
    kind: "followup",
    due_at: "2026-11-01T06:30:00.000Z",
    note: "Call back",
  });
});
