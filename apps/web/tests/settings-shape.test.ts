import { test, expect } from "vitest";
import { GET } from "../src/app/api/settings-shape/route";
import { shapeValid, type SettingShape } from "../src/lib/settings-shape";
test("settings form shape comes from the shared schema and preserves nullable and closed template constraints", async () => {
  const response = GET(new Request("http://localhost/api/settings-shape?scope=organization"));
  const shape = (await response.json()) as SettingShape;
  expect(shapeValid(shape.properties!.primary_color!, "#12AB34")).toBe(true);
  expect(shapeValid(shape.properties!.primary_color!, "invalid")).toBe(false);
  expect(
    shapeValid(shape.properties!.agreement_templates!, [
      { key: "draft", name: "Draft", discipline_id: "invented", format: "group", terms: {} },
    ]),
  ).toBe(false);
  expect(GET(new Request("http://localhost/api/settings-shape?scope=platform")).status).toBe(400);
});
test("nested arrays enforce unique selections and required values without accepting unknown keys", () => {
  const shape: SettingShape = {
    type: "object",
    required: ["days"],
    properties: {
      days: {
        type: "array",
        uniqueItems: true,
        minItems: 1,
        items: { type: "integer", minimum: 1, maximum: 7 },
      },
    },
  };
  expect(shapeValid(shape, { days: [1, 7] })).toBe(true);
  expect(shapeValid(shape, { days: [1, 1] })).toBe(false);
  expect(shapeValid(shape, { days: [8] })).toBe(false);
  expect(shapeValid(shape, { days: [1], hidden: true })).toBe(false);
});
