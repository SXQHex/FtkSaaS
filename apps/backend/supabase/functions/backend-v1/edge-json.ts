// Only data that crossed a JSON/network boundary is accepted here.
// A parsed JSON value is never a trusted TypeScript type by itself.
export type JsonRecord = Record<string, unknown>;
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
export function requireRecord(value: unknown): JsonRecord {
  if (!isRecord(value)) throw Error('INVALID_EXTERNAL_RESPONSE');
  return value;
}
export async function responseJson(response: Response): Promise<unknown> {
  const value: unknown = await response.json();
  return value;
}
export function parseJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  return value;
}
export function requireString(value: unknown): string {
  if (typeof value !== 'string') throw Error('INVALID_EXTERNAL_RESPONSE');
  return value;
}
export function requireInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw Error('INVALID_EXTERNAL_RESPONSE');
  return value;
}
