import { test, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { SettingsEditor } from "../src/components/settings/settings-editor";
import { readSettingsEditor } from "../src/lib/settings-editor";
import { editorChoices } from "../src/lib/settings-choices";
import tr from "../messages/tr.json";
vi.mock("../src/lib/settings-editor", async (load) => ({
  ...(await load<typeof import("../src/lib/settings-editor")>()),
  readSettingsEditor: vi.fn<typeof readSettingsEditor>(),
}));
vi.mock("../src/lib/settings-choices", () => ({ editorChoices: vi.fn<typeof editorChoices>() }));
test("inheriting a center template reviews live organization inheritance rather than presenting the old local content as its result", async () => {
  vi.mocked(editorChoices).mockResolvedValue({
    organizations: [],
    centers: [],
    disciplines: [],
    products: [],
    people: [],
  });
  vi.mocked(readSettingsEditor).mockResolvedValue({
    catalog: { scope: "center", fields: [{ key: "report_templates", writable: true }] },
    view: {
      scope: "center",
      version: 4,
      overridden_fields: ["report_templates"],
      values: { report_templates: [{ name: "Local A" }] },
    },
    shape: {
      type: "object",
      properties: {
        report_templates: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
        },
      },
    },
  } as never);
  const scope = { actorId: v7(), orgId: v7(), centerId: v7() };
  render(<SettingsEditor scope={scope} target="center" />);
  const user = userEvent.setup();
  await user.selectOptions(
    await screen.findByRole("combobox", { name: tr.settingsEditor.field }),
    "report_templates",
  );
  await user.type(
    screen.getByRole("textbox", { name: tr.settingsEditor.reason }),
    "Use current organization template",
  );
  await user.click(screen.getByRole("button", { name: tr.settingsEditor.inherit }));
  const review = screen.getByRole("region", { name: tr.flows.review });
  expect(within(review).getByText(tr.settingsEditor.inheritHint)).toBeInTheDocument();
  expect(within(review).queryByDisplayValue("Local A")).not.toBeInTheDocument();
});
