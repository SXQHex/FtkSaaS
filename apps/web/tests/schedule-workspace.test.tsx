import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type {
  CalendarItem,
  CenterView,
  OrganizationView,
  SessionView,
} from "@ftksaas/api-contracts";
import { render } from "./render";
import { ScheduleWorkspace } from "../src/components/calendar/schedule-workspace";
const mocks = vi.hoisted(() => ({
  calendar: vi.fn<typeof import("../src/lib/api").getCalendar>(),
  session: vi.fn<typeof import("../src/lib/api").getSession>(),
}));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  getCalendar: mocks.calendar,
  getSession: mocks.session,
}));
vi.mock("../src/components/programs/program-manager", () => ({
  ProgramManager: ({ onChanged }: { onChanged: () => void }) => (
    <section aria-label="Test program yönetimi">
      <button onClick={onChanged}>Test kaydet</button>
    </section>
  ),
}));
const organization: OrganizationView = {
  id: "org",
  name: "Test stüdyosu",
  state: "active",
  access_mode: "normal",
  version: 1,
};
const center: CenterView = {
  id: "center",
  name: "Merkez",
  timezone: "Europe/Istanbul",
  state: "active",
  accessible: true,
  version: 1,
};
const studios = [{ organization, centers: [center] }];
function item(title: string, startsAt: string): CalendarItem {
  return {
    id: title,
    title,
    type: "session",
    center_id: center.id,
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + 3600000).toISOString(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.calendar.mockResolvedValue([]);
});
test("late response from a previous date cannot replace the active day", async () => {
  const user = userEvent.setup();
  let finish!: (items: CalendarItem[]) => void;
  mocks.calendar.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mocks.calendar.mockImplementationOnce(async ({ interval }) => [
    item("Yeni günün dersi", interval.starts_at),
  ]);
  render(<ScheduleWorkspace studios={studios} />);
  await user.click(screen.getByRole("button", { name: "Sonraki dönem" }));
  expect(await screen.findByRole("heading", { name: "Yeni günün dersi" })).toBeVisible();
  await act(async () =>
    finish([item("Eski günün dersi", mocks.calendar.mock.calls[0][0].interval.starts_at)]),
  );
  expect(screen.queryByText("Eski günün dersi")).not.toBeInTheDocument();
});
test("refresh failures hide stale entries and retry recovers through the API", async () => {
  const user = userEvent.setup();
  mocks.calendar
    .mockImplementationOnce(async ({ interval }) => [item("Canlı ders", interval.starts_at)])
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([]);
  render(<ScheduleWorkspace studios={studios} />);
  await screen.findByRole("heading", { name: "Canlı ders" });
  await user.click(screen.getByRole("button", { name: "Programı yenile" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı kurulamadı");
  expect(screen.queryByText("Canlı ders")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByText("Bu aralıkta ders yok")).toBeVisible();
});
test("detail uses fresh backend state and capacity, never elapsed time as attendance", async () => {
  const user = userEvent.setup();
  mocks.calendar.mockImplementation(async ({ interval }) => [
    item("Canlı ders", interval.starts_at),
  ]);
  const session: SessionView = {
    id: "Canlı ders",
    class_id: null,
    discipline_id: "discipline",
    format: "group",
    starts_at: "2026-10-29T15:00:00Z",
    ends_at: "2026-10-29T16:00:00Z",
    state: "cancelled",
    attendance_state: "open",
    assignments: [],
    version: 3,
    capacity: {
      total: 10,
      held: 3,
      remaining: 7,
      category_held: null,
      category_remaining: null,
      room_capacity: 20,
    },
  };
  mocks.session.mockResolvedValue(session);
  render(<ScheduleWorkspace studios={studios} />);
  await user.click(await screen.findByRole("button", { name: /Canlı ders/ }));
  expect(await screen.findByText("İptal edildi")).toBeVisible();
  expect(screen.getByText("Açık", { exact: true })).toBeVisible();
  expect(mocks.session).toHaveBeenCalledExactlyOnceWith("org", "center", "Canlı ders");
});
test("closed organizations and inaccessible centers do not issue calendar requests", () => {
  render(
    <ScheduleWorkspace
      studios={[
        { organization: { ...organization, access_mode: "closed" }, centers: [center] },
        { organization, centers: [{ ...center, accessible: false }] },
      ]}
    />,
  );
  expect(screen.getByText("Ders programı için erişilebilir merkez yok")).toBeVisible();
  expect(mocks.calendar).not.toHaveBeenCalled();
});

test("management replaces the calendar and returns to the preserved period with fresh entries", async () => {
  const user = userEvent.setup();
  render(<ScheduleWorkspace studios={studios} actorId="actor" />);
  await screen.findByText("Bu aralıkta ders yok");
  await user.click(screen.getByRole("button", { name: "Sonraki dönem" }));
  await waitFor(() => expect(mocks.calendar).toHaveBeenCalledTimes(2));
  const period = mocks.calendar.mock.calls[1][0].interval;
  await user.click(screen.getByRole("button", { name: "Sınıf ve program yönetimi" }));
  expect(screen.getByRole("region", { name: "Test program yönetimi" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Sonraki dönem" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Test kaydet" }));
  await waitFor(() => expect(mocks.calendar).toHaveBeenCalledTimes(3));
  expect(mocks.calendar.mock.calls[2][0].interval).toEqual(period);
  await user.click(screen.getByRole("button", { name: "Takvime dön" }));
  expect(screen.getByRole("button", { name: "Sonraki dönem" })).toBeVisible();
  expect(screen.queryByRole("region", { name: "Test program yönetimi" })).not.toBeInTheDocument();
});
