import { beforeEach, expect, test } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { AttendancePanel } from "../src/components/attendance/attendance-panel";
import { id, reservation, scope, session, view, makeApi } from "./attendance-fixtures";
beforeEach(() => sessionStorage.clear());
const second = {
  ...view.entries[0]!,
  reservation_id: "019a2b3c-4d5e-7000-8000-000000000004",
  person_id: reservation,
  subscriber_number: null,
};
test("closing an incomplete sheet leads to the real unmarked row with stable numbering and keyboard focus", async () => {
  const user = userEvent.setup();
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="UTC"
      api={{
        ...makeApi(),
        read: async () => ({
          session,
          view: { ...view, entries: [{ ...view.entries[0]!, result: "attended" }, second] },
        }),
        access: async (_scope, op) => op === "attendance_close_v1",
      }}
    />,
  );
  const close = within(await screen.findByRole("region", { name: "Yoklamayı kapat" }));
  expect(close.getByRole("button", { name: "İşlemi incele" })).toBeDisabled();
  await user.click(close.getByRole("button", { name: "İşaretlenmemiş katılımcıya git" }));
  expect(screen.getByRole("heading", { name: "Katılımcı 2" })).toHaveFocus();
  expect(screen.queryByRole("heading", { name: "Abone No 1001" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Katılım filtresi")).toHaveValue("unmarked");
  await user.selectOptions(screen.getByLabelText("Katılım filtresi"), "all");
  await user.type(screen.getByLabelText("Abone No ile bul"), "1001");
  expect(screen.getByRole("heading", { name: "Abone No 1001" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Katılımcı 2" })).not.toBeInTheDocument();
});
test("a closed sheet's actual results cannot be counted as currently unmarked just by filtering", async () => {
  const user = userEvent.setup();
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="UTC"
      api={{
        ...makeApi(),
        read: async () => ({
          session: { ...session, state: "occurred", attendance_state: "closed" },
          view: {
            ...view,
            closure_state: "closed",
            entries: [{ ...view.entries[0]!, result: "attended" }],
          },
        }),
      }}
    />,
  );
  await user.selectOptions(await screen.findByLabelText("Katılım filtresi"), "unmarked");
  expect(screen.getByText("Bu filtrede katılımcı yok.")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Yoklamayı kapat" })).not.toBeInTheDocument();
});
