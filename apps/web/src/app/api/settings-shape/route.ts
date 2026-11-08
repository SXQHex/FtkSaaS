import schema from "@ftksaas/api-contracts/schema";
import type { SettingShape } from "../../../lib/settings-shape";
const scopes = {
  user: "UserSettingsValues",
  member: "MemberSettingsValues",
  center: "CenterSettingsValues",
  organization: "OrganizationSettingsValues",
} as const;
const definitions = schema.$defs as Record<string, unknown>;
function expand(input: unknown, depth = 0): SettingShape {
  if (depth > 30 || !input || typeof input !== "object") throw Error("Invalid settings schema");
  const s = input as SettingShape & { $ref?: string };
  if (s.$ref) {
    const name = s.$ref.split("/").at(-1)!;
    return { ...expand(definitions[name], depth + 1), reference: name };
  }
  const out: SettingShape = {};
  for (const key of [
    "type",
    "const",
    "enum",
    "required",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "uniqueItems",
    "pattern",
    "format",
  ] as const) {
    if (s[key] !== undefined) Object.assign(out, { [key]: s[key] });
  }
  if (s.properties)
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, expand(v, depth + 1)]),
    );
  if (s.items) out.items = expand(s.items, depth + 1);
  for (const k of ["anyOf", "oneOf", "allOf"] as const)
    if (s[k]) out[k] = s[k]!.map((v) => expand(v, depth + 1));
  return out;
}
export function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("scope");
  if (!target || !Object.hasOwn(scopes, target))
    return Response.json({ error: "scope" }, { status: 400 });
  const definition = scopes[target as keyof typeof scopes];
  return Response.json(expand(definitions[definition]), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
