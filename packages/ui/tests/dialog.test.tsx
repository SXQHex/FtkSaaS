import { expect, test } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "../src/components/sheet";
import { Button } from "../src/components/button";
test("mobile menu opens by keyboard, closes with Escape, and returns focus", async () => {
  const user = userEvent.setup();
  render(
    <Sheet>
      <SheetTrigger asChild>
        <Button>Menüyü aç</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle>Gezinme</SheetTitle>
        <SheetDescription>Uygulama bölümleri</SheetDescription>
      </SheetContent>
    </Sheet>,
  );
  await user.tab();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("dialog", { name: "Gezinme" })).toBeVisible();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Menüyü aç" })).toHaveFocus();
});
