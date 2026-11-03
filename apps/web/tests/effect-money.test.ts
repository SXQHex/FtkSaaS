import { expect, test } from "vitest";
import { effectMoney } from "../src/lib/effect-money";
test("preview amounts keep integer precision, minor-unit sign and currency exponent", () => {
  expect(effectMoney("9007199254740993", "USD", "en-US")).toBe("$90,071,992,547,409.93");
  expect(effectMoney("-1", "USD", "en-US")).toBe("-$0.01");
  expect(effectMoney("1", "JPY", "en-US")).toBe("¥1");
});
