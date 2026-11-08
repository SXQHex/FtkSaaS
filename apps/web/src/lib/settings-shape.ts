export type SettingShape = {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, SettingShape>;
  required?: string[];
  items?: SettingShape;
  anyOf?: SettingShape[];
  oneOf?: SettingShape[];
  allOf?: SettingShape[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  pattern?: string;
  format?: string;
  title?: string;
  reference?: string;
};
export function shapeBranches(s: SettingShape) {
  return s.oneOf ?? s.anyOf ?? [];
}
export function shapeValid(s: SettingShape, v: unknown): boolean {
  if (s.allOf && !s.allOf.every((b) => shapeValid(b, v))) return false;
  if (s.oneOf && s.oneOf.filter((b) => shapeValid(b, v)).length !== 1) return false;
  if (s.anyOf && !s.anyOf.some((b) => shapeValid(b, v))) return false;
  if (Object.hasOwn(s, "const") && JSON.stringify(v) !== JSON.stringify(s.const)) return false;
  if (s.enum && !s.enum.some((x) => JSON.stringify(x) === JSON.stringify(v))) return false;
  if (s.type === "null") return v === null;
  if (s.type === "boolean") return typeof v === "boolean";
  if (s.type === "integer" || s.type === "number")
    return (
      typeof v === "number" &&
      Number.isFinite(v) &&
      (s.type !== "integer" || Number.isSafeInteger(v)) &&
      (s.minimum === undefined || v >= s.minimum) &&
      (s.maximum === undefined || v <= s.maximum)
    );
  if (s.type === "string") {
    if (
      typeof v !== "string" ||
      (s.minLength !== undefined && v.length < s.minLength) ||
      (s.maxLength !== undefined && v.length > s.maxLength) ||
      (s.pattern && !new RegExp(s.pattern).test(v))
    )
      return false;
    if (s.format === "date-time" && !Number.isFinite(Date.parse(v))) return false;
    if (s.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    if (s.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
    return true;
  }
  if (s.type === "array")
    return (
      Array.isArray(v) &&
      (s.minItems === undefined || v.length >= s.minItems) &&
      (s.maxItems === undefined || v.length <= s.maxItems) &&
      (!s.uniqueItems || new Set(v.map((x) => JSON.stringify(x))).size === v.length) &&
      (!s.items || v.every((x) => shapeValid(s.items!, x)))
    );
  if (s.type === "object") {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const r = v as Record<string, unknown>;
    return (
      (s.required ?? []).every((k) => Object.hasOwn(r, k)) &&
      Object.entries(r).every(([k, x]) => !!s.properties?.[k] && shapeValid(s.properties[k], x))
    );
  }
  return true;
}
export function initialShape(s: SettingShape): unknown {
  if (Object.hasOwn(s, "const")) return s.const;
  if (s.enum) return "";
  if (shapeBranches(s).length) return initialShape(shapeBranches(s)[0]!);
  if (s.type === "object")
    return Object.fromEntries(
      (s.required ?? []).map((k) => [k, initialShape(s.properties?.[k] ?? {})]),
    );
  if (s.type === "array") return [];
  if (s.type === "boolean") return false;
  if (s.type === "null") return null;
  return "";
}
