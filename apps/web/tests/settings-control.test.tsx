import { test, expect } from "vitest";
import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { SettingControl } from "../src/components/settings/setting-control";
function Nullable() {
  const [value, setValue] = useState<unknown>(null);
  return (
    <>
      <SettingControl
        name="quota"
        shape={{
          anyOf: [
            {
              type: "object",
              required: ["limit"],
              properties: { limit: { type: "integer", minimum: 1 } },
            },
            { type: "null" },
          ],
        }}
        value={value}
        onChange={setValue}
        choices={{}}
      />
      <output>{JSON.stringify(value)}</output>
    </>
  );
}
test("nullable template objects keep the selected unfinished variant until its required values are entered", async () => {
  render(<Nullable />);
  const user = userEvent.setup();
  await user.selectOptions(screen.getByRole("combobox"), "0");
  await user.type(screen.getByRole("spinbutton", { name: "Limit" }), "5");
  expect(screen.getByRole("status")).toHaveTextContent('{"limit":5}');
  expect(screen.getByRole("combobox")).toHaveValue("0");
});
test("template identity fields use named native choices and preserve explicit selection", async () => {
  const change = (v: unknown) => {
    expect(v).toBe("native-product");
  };
  render(
    <SettingControl
      name="product_id"
      shape={{ type: "string", reference: "FtkUuid" }}
      value=""
      onChange={change}
      choices={{ products: [{ id: "native-product", name: "Aylık paket" }] }}
    />,
  );
  await userEvent.selectOptions(screen.getByRole("combobox"), "native-product");
  expect(
    within(screen.getByRole("combobox")).getByRole("option", { name: "Aylık paket" }),
  ).toBeInTheDocument();
});
