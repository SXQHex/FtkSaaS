import { expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { FinanceReport } from "../src/components/finance/finance-report";
import type { FinanceReportApi } from "../src/lib/finance-report";
const scope = { actorId: "actor", orgId: "org", centerId: "center" };
const data: ReportView = {
  report_kind: "collections_debts",
  as_of: "2026-11-07T00:00:00Z",
  filters: {
    interval: { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-08T00:00:00Z" },
    center_ids: ["center"],
  },
  rows: {
    as_of: "2026-11-07T00:00:00Z",
    items: [{ group_key: "collections", currency: "TRY", count: 1, amount_minor: "120000" }],
    next_cursor: "next",
  },
  totals: [{ group_key: "collections", currency: "TRY", count: 2, amount_minor: "160000" }],
};
test("pagination retains server query totals and date change starts at first page", async () => {
  const user = userEvent.setup(),
    read = vi.fn<FinanceReportApi["read"]>().mockResolvedValue(data);
  render(
    <FinanceReport
      scope={scope}
      personId="person"
      currency="TRY"
      timeZone="Europe/Istanbul"
      api={{ read }}
    />,
  );
  await screen.findByText(/Tahsilatlar · ₺1.200,00/);
  expect(screen.getByText(/Tahsilatlar · ₺1.600,00/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Sonraki rapor satırları" }));
  await waitFor(() => expect(read.mock.lastCall?.[4]).toBe("next"));
  await user.selectOptions(screen.getByLabelText("Tarih aralığı"), "day");
  await waitFor(() => expect(read.mock.lastCall?.[4]).toBeUndefined());
  expect(read.mock.lastCall?.[3].ends_at).not.toBe(read.mock.lastCall?.[3].starts_at);
});
test("scope changes discard displayed values and late previous results", async () => {
  let finish: (v: ReportView) => void = () => {};
  const read = vi
    .fn<FinanceReportApi["read"]>()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    )
    .mockRejectedValueOnce(Error("FORBIDDEN"));
  const api = { read };
  const view = render(
    <FinanceReport
      scope={scope}
      personId="first"
      currency="TRY"
      timeZone="Europe/Istanbul"
      api={api}
    />,
  );
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  view.rerender(
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      <FinanceReport
        scope={scope}
        personId="second"
        currency="TRY"
        timeZone="Europe/Istanbul"
        api={api}
      />
    </NextIntlClientProvider>,
  );
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  finish(data);
  await waitFor(() =>
    expect(screen.queryByText(/Tahsilatlar · ₺1.200,00/)).not.toBeInTheDocument(),
  );
  expect(await screen.findByRole("alert")).toBeVisible();
});
