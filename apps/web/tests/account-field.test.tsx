import { expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { AccountField } from "../src/components/account/account-field";

test("required fields show inline errors only after submit and focus the first invalid field", async () => {
  const submit = vi.fn<(event: React.FormEvent<HTMLFormElement>) => void>((event) =>
    event.preventDefault(),
  );
  const user = userEvent.setup();
  render(
    <form onSubmit={submit}>
      <AccountField id="email" label="E-posta" name="email" type="email" required />
      <AccountField id="name" label="Ad" required />
      <button>Kaydet</button>
    </form>,
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("E-posta")).toHaveAttribute("placeholder", "E-posta");
  expect(screen.getByLabelText("E-posta")).toBeRequired();
  await user.click(screen.getByRole("button", { name: "Kaydet" }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByLabelText("E-posta")).toHaveFocus();
  expect(screen.getByLabelText("E-posta")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("E-posta")).toHaveAccessibleDescription("Bu alan zorunludur.");
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  await user.type(screen.getByLabelText("E-posta"), "member@example.invalid");
  expect(screen.getByLabelText("E-posta")).toHaveAttribute("aria-invalid", "false");
  await user.type(screen.getByLabelText("Ad"), "Synthetic");
  await user.click(screen.getByRole("button", { name: "Kaydet" }));
  expect(submit).toHaveBeenCalledOnce();
});
test("invalid email and phone format stay beside their own fields", async () => {
  const user = userEvent.setup();
  render(
    <form>
      <AccountField id="email" label="E-posta" type="email" />
      <AccountField id="phone" label="Telefon" pattern="\\+[1-9][0-9]{7,14}" />
      <button>Kaydet</button>
    </form>,
  );
  await user.type(screen.getByLabelText("E-posta"), "invalid");
  await user.type(screen.getByLabelText("Telefon"), "555");
  await user.click(screen.getByRole("button", { name: "Kaydet" }));
  expect(screen.getByLabelText("E-posta")).toHaveAccessibleDescription(
    "Geçerli bir e-posta adresi gir.",
  );
  expect(screen.getByLabelText("Telefon")).toHaveAccessibleDescription(
    "Geçerli biçimde bir değer gir.",
  );
});

test("required checkbox errors remain inline in English", async () => {
  const user = userEvent.setup();
  render(
    <form>
      <AccountField id="confirm" label="Confirm" type="checkbox" required />
      <button>Save</button>
    </form>,
    "en",
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("checkbox", { name: "Confirm" })).toHaveAccessibleDescription(
    "This field is required.",
  );
  await user.click(screen.getByRole("checkbox", { name: "Confirm" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
