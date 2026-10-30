import { expect, test } from "vitest";
import { safeReturnPath } from "../src/lib/config";
test("auth return path rejects external, protocol-relative, and backslash redirects", () => {
  for (const path of [
    null,
    "https://attacker.invalid",
    "//attacker.invalid",
    "/\\attacker.invalid",
    "/\n/attacker.invalid",
  ])
    expect(safeReturnPath(path)).toBe("/");
  expect(safeReturnPath("/reset-password")).toBe("/reset-password");
});
