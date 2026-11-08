import { type SetupScope } from "./studio-setup";
import { deliveryQuery, type DeliveryTarget, readDeliverySettings } from "./delivery-settings";
import type { SettingShape } from "./settings-shape";
export async function readSettingsEditor(scope: SetupScope, target: DeliveryTarget) {
  const [source, response] = await Promise.all([
    readDeliverySettings(scope, target),
    fetch(`/api/settings-shape?scope=${target}`),
  ]);
  if (!response.ok) throw Error("invalidSettings");
  const shape = (await response.json()) as SettingShape;
  if (shape.type !== "object" || !shape.properties) throw Error("invalidSettings");
  return { ...source, shape };
}
export const editorQuery = deliveryQuery;
