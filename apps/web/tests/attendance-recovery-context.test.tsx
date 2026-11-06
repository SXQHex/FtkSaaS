import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { AttendancePanel } from "../src/components/attendance/attendance-panel";
import { AttendanceDocuments } from "../src/components/attendance/attendance-documents";
import { attendanceApi, type AttendanceApi } from "../src/lib/attendance";
import { documentReadActions } from "../src/lib/document-requirements";
import { id, reservation, person, scope, session, view, makeApi } from "./attendance-fixtures";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("attendance documents use the exact authorized person/reservation context without a person lookup or an acceptance command", async () => {
  const personRead = vi.fn<typeof documentReadActions.person>(),
    file = vi.fn<typeof documentReadActions.file>();
  server.use(
    http.post("*/functions/v1/backend-v1/document_requirements_get_v1", async ({ request }) => {
      expect(await request.json()).toMatchObject({
        org_id: scope.orgId,
        center_id: scope.centerId,
        person_id: person,
        context: { gate: "attendance", subject: { type: "reservations", id: reservation } },
      });
      return HttpResponse.json({
        ok: true,
        trace_id: id,
        data: [
          {
            id,
            version_id: reservation,
            name: "Katılım koşulları",
            required_at: "attendance",
            accepted: false,
            content_hash: "synthetic",
            file: { type: "files", id: reservation },
          },
        ],
      });
    }),
  );
  render(
    <AttendanceDocuments
      scope={scope}
      reservationId={reservation}
      personId={person}
      actions={{ read: documentReadActions.read, person: personRead, file }}
    />,
  );
  expect(
    await screen.findByRole("button", { name: "Katılım koşulları belgesini aç" }),
  ).toBeVisible();
  expect(personRead).not.toHaveBeenCalled();
  expect(file).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /kabul et/i })).not.toBeInTheDocument();
});
test("open attendance exposes per-person rights recovery and one denied person cannot hide another's result", async () => {
  const user = userEvent.setup(),
    other = "019a2b3c-4d5e-7000-8000-000000000004",
    readPeople: string[] = [];
  let allowFirst = false;
  server.use(
    http.post("*/functions/v1/backend-v1/entitlements_get_v1", async ({ request }) => {
      const body = (await request.json()) as { person_id: string };
      readPeople.push(body.person_id);
      if (body.person_id === person && !allowFirst)
        return HttpResponse.json({
          ok: false,
          trace_id: id,
          error: { code: "FORBIDDEN", retryable: false, trace_id: id },
        });
      return HttpResponse.json({
        ok: true,
        trace_id: id,
        data: [
          {
            sale_id: id,
            person_id: body.person_id,
            start_date: "2026-01-01",
            end_date: "2027-01-01",
            timezone: "Europe/Istanbul",
            state: "active",
            available: 5,
            reserved: 1,
            consumed: 2,
            deficit: 0,
            quotas: [],
            deficit_scopes: [],
          },
        ],
      });
    }),
  );
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="UTC"
      api={{
        ...makeApi(),
        rights: attendanceApi.rights,
        read: async () => ({
          session,
          view: {
            ...view,
            entries: [
              ...view.entries,
              {
                ...view.entries[0]!,
                person_id: other,
                reservation_id: other,
                subscriber_number: "1002",
              },
            ],
          },
        }),
      }}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Hakları yeniden oku" }));
  expect(await screen.findByText("Kullanılabilir 5, ayrılmış 1, kullanılmış 2.")).toBeVisible();
  expect(await screen.findByRole("alert")).toHaveTextContent("Yetki veya güncel katılım koşulları");
  expect(screen.queryByText("Bu kişi için hak kaydı yok.")).not.toBeInTheDocument();
  allowFirst = true;
  await user.click(screen.getByRole("button", { name: "Bu kişinin haklarını yeniden oku" }));
  await waitFor(() =>
    expect(screen.getAllByText("Kullanılabilir 5, ayrılmış 1, kullanılmış 2.")).toHaveLength(2),
  );
  expect(readPeople.filter((value) => value === other)).toHaveLength(1);
  expect(readPeople.filter((value) => value === person)).toHaveLength(2);
});
test("an eligibility rejection remains attached to the real participant and offers keyboard return without claiming pure role loss", async () => {
  const user = userEvent.setup(),
    api: AttendanceApi = {
      ...makeApi(),
      access: async (_scope, op) => op === "attendance_mark_v1",
    };
  server.use(
    http.post("*/functions/v1/backend-v1/attendance_mark_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: id,
        error: { code: "FORBIDDEN", retryable: false, trace_id: id },
      }),
    ),
  );
  render(<AttendancePanel scope={scope} sessionId={id} timeZone="UTC" api={api} />);
  await user.click(await screen.findByRole("button", { name: "Katılımı işaretle" }));
  await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "attended");
  await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  expect(await screen.findByText("İşlem tamamlanamadı: Abone No 1001")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Yetki veya güncel katılım koşulları");
  await user.click(screen.getByRole("button", { name: "Bu katılımcıya dön" }));
  expect(screen.getByRole("heading", { name: "Abone No 1001" })).toHaveFocus();
});
