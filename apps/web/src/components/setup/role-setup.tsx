"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { PersonSummary, RoleView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, errorKey, useSetupCommand } from "./setup-command";
import { AvailabilityEditor } from "./availability-editor";

type NamedRole = { role: RoleView; name: string | null };
function RevokeRole({
  scope,
  entry,
  onSaved,
}: {
  scope: SetupScope;
  entry: NamedRole;
  onSaved: () => void;
}) {
  const t = useTranslations("setup");
  const command = useSetupCommand(scope, `revoke:${entry.role.id}`, onSaved);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={command.busy || !!command.pending}
        onClick={() => setConfirm(!confirm)}
      >
        {t("revokeRole")}
      </Button>
      {confirm && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = String(new FormData(event.currentTarget).get("reason")).trim();
            const base = {
              org_id: scope.orgId,
              center_id: scope.centerId,
              operation_key: v7(),
              expected_version: entry.role.version,
              reason,
            };
            if (entry.role.role === "center_manager")
              void command.run({
                operation: "center_manager_revoke_v1",
                input: { ...base, person_id: entry.role.person_id },
              });
            else
              void command.run({
                operation: "role_revoke_v1",
                input: { ...base, assignment_id: entry.role.id },
              });
          }}
        >
          <Label htmlFor={`reason-${entry.role.id}`}>{t("reason")}</Label>
          <Input
            id={`reason-${entry.role.id}`}
            name="reason"
            required
            disabled={command.busy || !!command.pending}
          />
          <Button variant="destructive" disabled={command.busy || !!command.pending}>
            {t("confirmRevoke")}
          </Button>
        </form>
      )}
      <SetupFeedback command={command} />
    </div>
  );
}
function AssignRole({ scope, onSaved }: { scope: SetupScope; onSaved: () => void }) {
  const t = useTranslations("setup");
  const command = useSetupCommand(scope, "assign", onSaved);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState<{ items: PersonSummary[]; next_cursor: string | null } | null>(
    null,
  );
  const [cursor, setCursor] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void setupCall("people_list_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      ...(submitted ? { query: submitted } : {}),
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    })
      .then((result) => {
        if (active) {
          setPage({ items: result.items, next_cursor: result.next_cursor ?? null });
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setPage(null);
          setError(errorKey(setupError(cause)));
        }
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, submitted, cursor, refresh]);
  return (
    <section className="space-y-4" aria-label={t("assignRole")}>
      <h4 className="font-medium">{t("assignRole")}</h4>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(null);
          setCursor(undefined);
          setSubmitted(query.trim());
          setRefresh((n) => n + 1);
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="role-person-search">{t("searchPerson")}</Label>
          <Input
            id="role-person-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          {t("search")}
        </Button>
      </form>
      {error && <p role="alert">{t(error)}</p>}
      {!page && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {page && (
        <form
          key={`${submitted}:${cursor ?? "first"}`}
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const personId = String(data.get("person"));
            if (!page.items.some((person) => person.id === personId)) return;
            const base = {
              org_id: scope.orgId,
              center_id: scope.centerId,
              operation_key: v7(),
              person_id: personId,
            };
            if (data.get("role") === "center_manager")
              void command.run({ operation: "center_manager_assign_v1", input: base });
            else
              void command.run({
                operation: "role_assign_v1",
                input: { ...base, role: "instructor", scope: { center_id: scope.centerId! } },
              });
          }}
        >
          {page.items.length ? (
            <fieldset disabled={command.busy || !!command.pending} className="space-y-3">
              <Label htmlFor="assign-person">{t("person")}</Label>
              <select
                id="assign-person"
                name="person"
                required
                defaultValue=""
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  {t("choosePerson")}
                </option>
                {page.items.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.display_name}
                  </option>
                ))}
              </select>
              <Label htmlFor="assign-role">{t("role")}</Label>
              <select
                id="assign-role"
                name="role"
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="instructor">{t("roles.instructor")}</option>
                <option value="center_manager">{t("roles.center_manager")}</option>
              </select>
              <p className="text-sm text-muted-foreground">{t("roleHint")}</p>
              <Button>{t("confirmAssign")}</Button>
            </fieldset>
          ) : (
            <p>{t("noPeople")}</p>
          )}
        </form>
      )}
      {page?.next_cursor && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCursor(page.next_cursor!);
            setPage(null);
          }}
        >
          {t("morePeople")}
        </Button>
      )}
      <SetupFeedback command={command} />
    </section>
  );
}
export function RoleSetup({ scope, onChanged }: { scope: SetupScope; onChanged: () => void }) {
  const t = useTranslations("setup");
  const [roles, setRoles] = useState<NamedRole[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      const rows: RoleView[] = [];
      let cursor: string | null | undefined;
      do {
        const result = await setupCall("roles_list_v1", {
          org_id: scope.orgId,
          center_id: scope.centerId,
          page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
        });
        rows.push(...result.items);
        cursor = result.next_cursor;
      } while (cursor);
      const entries = await Promise.all(
        rows
          .filter(
            (role) =>
              ["instructor", "center_manager"].includes(role.role) &&
              role.scope_center_id === scope.centerId,
          )
          .map(async (role) => {
            let name: string | null = null;
            try {
              name = (
                await setupCall("person_get_v1", {
                  org_id: scope.orgId,
                  center_id: scope.centerId,
                  person_id: role.person_id,
                })
              ).display_name;
            } catch {
              /* Name access is independent of the visible assignment. */
            }
            return { role, name };
          }),
      );
      if (active) {
        setRoles(entries);
        setError("");
      }
    }
    void load().catch((cause) => {
      if (active) {
        setRoles(null);
        setError(errorKey(setupError(cause)));
      }
    });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, retry]);
  function saved() {
    setRetry((n) => n + 1);
    onChanged();
  }
  return (
    <section className="space-y-6" aria-labelledby="setup-roles-heading">
      <h3 id="setup-roles-heading" className="text-lg font-semibold">
        {t("rolesTitle")}
      </h3>
      <Button type="button" variant="outline" onClick={() => setRetry((n) => n + 1)}>
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!roles && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {roles && (
        <>
          <ul className="divide-y">
            {roles.map((entry) => (
              <li key={`${entry.role.id}:${entry.role.version}`} className="space-y-3 py-4">
                <p className="font-medium">{entry.name ?? t("nameUnavailable")}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`roles.${entry.role.role}`)} ·{" "}
                  {t(entry.role.state === "active" ? "active" : "inactive")}
                </p>
                {entry.role.state === "active" && (
                  <RevokeRole scope={scope} entry={entry} onSaved={saved} />
                )}
              </li>
            ))}
          </ul>
          <AssignRole scope={scope} onSaved={saved} />
          {roles
            .filter(({ role }) => role.role === "instructor" && role.state === "active")
            .map(({ role, name }) => (
              <div key={role.id} className="space-y-3 border-t pt-6">
                <p className="font-medium">{name ?? t("nameUnavailable")}</p>
                <AvailabilityEditor
                  scope={scope}
                  resource={{ kind: "person", id: role.person_id }}
                />
              </div>
            ))}
        </>
      )}
    </section>
  );
}
