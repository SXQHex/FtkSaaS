import {isRecord,isUnknownArray} from './edge-json.ts';
// Authentication comes from native Auth, not from decoded JWT attributes.
// These guards only select the validated fields the gateway actually consumes.
export interface NativeUser {
  id: string;
  hasVerifiedFactor: boolean;
}
export interface SessionClaims {
  sub: string;
  session_id: string;
  aal: 'aal1' | 'aal2';
}
export function nativeUser(value: unknown): NativeUser | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
  const factors = value.factors;
  if (factors !== undefined && factors !== null &&
      (!isUnknownArray(factors) || !factors.every(factor => isRecord(factor) && typeof factor.status === 'string'))) return null;
  return {id: value.id, hasVerifiedFactor: isUnknownArray(factors) && factors.some(factor => isRecord(factor) && factor.status === 'verified')};
}
export function sessionClaims(value: unknown): SessionClaims | null {
  if (!isRecord(value) || typeof value.sub !== 'string' || typeof value.session_id !== 'string' ||
      !value.session_id || (value.aal !== undefined && value.aal !== 'aal1' && value.aal !== 'aal2')) return null;
  return {sub: value.sub, session_id: value.session_id, aal: value.aal ?? 'aal1'};
}
