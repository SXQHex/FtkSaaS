import { validate } from "uuid";
import { discoverPendingOperations } from "./pending-operations";
import { restoreJob } from "./job-record";
import type { SetupScope } from "./studio-setup";
export function organizationRecoveries(actor: string) {
  const pending = discoverPendingOperations(actor);
  if (pending === null) throw Error("storageFailed");
  const scopes = new Map<string, SetupScope>();
  for (const p of pending) if (p.slot === "organization-delete") scopes.set(p.scope.orgId, p.scope);
  const prefix = `ftksaas:job:v1:${actor}:`;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(prefix) || !key.endsWith(":organization-delete")) continue;
    const rest = key.slice(prefix.length).split(":");
    if (rest.length !== 3 || !validate(rest[0]!) || rest[1] !== "undefined")
      throw Error("invalidJob");
    scopes.set(rest[0]!, { actorId: actor, orgId: rest[0]! });
  }
  return [...scopes.values()].map((scope) => ({
    scope,
    job: restoreJob(scope, "organization-delete"),
    pending: pending.some((p) => p.scope.orgId === scope.orgId && p.slot === "organization-delete"),
  }));
}
