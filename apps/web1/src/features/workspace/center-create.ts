import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import { readWorkspace } from "./workspace";

type OrganizationScope = Pick<ClientScope, "accountId" | "orgId">;
export const centerDraftSchema = z.object({
  name: z.string().trim().min(1),
  timezone: z
    .string()
    .min(1)
    .refine((value) => value === "UTC" || Intl.supportedValuesOf("timeZone").includes(value)),
});
export function centerCreateIntent(
  scope: OrganizationScope,
  draft: z.input<typeof centerDraftSchema>,
) {
  return { scope: { ...scope }, ...centerDraftSchema.parse(draft), key: uuidv7() };
}
export type CenterCreateIntent = ReturnType<typeof centerCreateIntent>;
const common = (intent: CenterCreateIntent) => ({
  client_api_version: 1 as const,
  request_id: uuidv7(),
  org_id: intent.scope.orgId,
});
export async function writeCenter(intent: CenterCreateIntent) {
  return (await scopedBackend(intent.scope)).call("center_create_v1", {
    ...common(intent),
    operation_key: intent.key,
    name: intent.name,
    timezone: intent.timezone,
  });
}
export async function centerCreateReceipt(intent: CenterCreateIntent) {
  const receipt = await (
    await scopedBackend(intent.scope)
  ).call("operation_status_get_v1", {
    ...common(intent),
    operation: "center_create_v1",
    key: intent.key,
  });
  if (
    receipt.operation !== "center_create_v1" ||
    receipt.key !== intent.key ||
    (receipt.result_reference && receipt.result_reference.type !== "centers")
  )
    throw Error("CENTER_RECEIPT_UNAVAILABLE");
  return receipt;
}
export async function readCreatedCenter(intent: CenterCreateIntent, id?: string) {
  if (!id) throw Error("CENTER_RESULT_UNAVAILABLE");
  const workspace = await readWorkspace(intent.scope.accountId, intent.scope.orgId);
  const center = workspace.centers.find((row) => row.id === id);
  if (
    workspace.selected?.id !== intent.scope.orgId ||
    !center ||
    center.state !== "active" ||
    center.name !== intent.name ||
    center.timezone !== intent.timezone
  )
    throw Error("CENTER_RESULT_UNAVAILABLE");
  return { workspace, center };
}
