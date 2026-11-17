import { v7 as uuidv7 } from "uuid";
import { BackendError, createBackend } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import type { OrganizationView, CenterView, RoleView } from "../../lib/api-contracts/generated";

export async function readWorkspace(accountId: string, organizationId?: string) {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("AUTH_REQUIRED");
  const token = data.session.access_token;
  const backend = createBackend({
    functionsUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backend-v1`,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    getAccessToken: async () => token,
  });
  const account = await backend.call("account_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
  });
  if (account.id !== accountId) throw new Error("ACCOUNT_CHANGED");
  const organizations: OrganizationView[] = [];
  let cursor: string | undefined;
  do {
    const page = await backend.call("organizations_list_v1", {
      client_api_version: 1,
      request_id: uuidv7(),
      page: { limit: 50, ...(cursor ? { cursor } : {}) },
    });
    organizations.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  const selected = organizationId
    ? organizations.find((org) => org.id === organizationId)
    : organizations.length === 1
      ? organizations[0]
      : undefined;
  const centers: CenterView[] = [],
    roles: RoleView[] = [];
  if (selected) {
    do {
      const page = await backend.call("centers_list_v1", {
        client_api_version: 1,
        request_id: uuidv7(),
        org_id: selected.id,
        page: { limit: 50, ...(cursor ? { cursor } : {}) },
      });
      centers.push(...page.items.filter((center) => center.accessible));
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
    const personId = selected.self_context?.person_id;
    if (personId) {
      try {
        do {
          const page = await backend.call("roles_list_v1", {
            client_api_version: 1,
            request_id: uuidv7(),
            org_id: selected.id,
            person_id: personId,
            page: { limit: 50, ...(cursor ? { cursor } : {}) },
          });
          roles.push(...page.items.filter((role) => role.state === "active"));
          cursor = page.next_cursor ?? undefined;
        } while (cursor);
      } catch (error) {
        // The role registry is a management reader, not a self-role endpoint.
        // Instructor/student scope remains authoritative in self_context.
        if (!(error instanceof BackendError) || error.code !== "FORBIDDEN") throw error;
        roles.length = 0;
      }
    }
  }
  return { organizations, selected, centers, roles };
}
