import { useCallback, useState } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { LinkButton } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import type { AccountView, CenterView } from "../../lib/api-contracts/generated";
import type { ClientScope } from "../../lib/scoped-backend";
import { getSupabaseClient } from "../../lib/supabase";
import { useAccountAppearance } from "../account/use-account-appearance";
import { settingsSubscriptionQuery } from "../settings/settings-subscription";
import { workspaceRoles } from "../workspace/workspace";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { BusinessCenterResources } from "./business-center-resources";
import { BusinessCenterCreate } from "./business-center-create";
import { BusinessReport } from "./business-report";
import { BusinessMergeSuggestions } from "./business-merge-suggestions";
import { BusinessProductScope } from "./business-product-scope";
import { BusinessSettlement } from "./business-settlement";
import { BusinessSettlementAuthority } from "./business-settlement-authority";
import { BusinessApplications, BusinessPeople } from "./business-directory";
import { businessWorkspaceQuery } from "./business-workspace";

const route = getRouteApi("/o/$orgId/c/$centerId/centers");
const sections = [
  "centers",
  "managers",
  "policies",
  "disciplines",
  "people",
  "applications",
  "settlement",
  "reports",
] as const;

export function BusinessCentersRoutePage() {
  const account = route.useLoaderData();
  const { orgId, centerId } = route.useParams();
  return (
    <BusinessCentersPage
      key={account.id + orgId + centerId}
      account={account}
      orgId={orgId}
      centerId={centerId}
    />
  );
}

function BusinessCentersPage({
  account,
  orgId,
  centerId,
}: {
  account: AccountView;
  orgId: string;
  centerId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const client = useQueryClient();
  useAccountAppearance(account.id);
  const [organizationId, setOrganization] = useState(orgId);
  const [selectedCenter, setCenter] = useState<string | undefined>(centerId);
  const [locked, setLocked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const title = t(($) => $.businessCenters.title);
  const resolved = useCallback(
    (selection: WorkspaceSelection) => {
      if (
        locked ||
        !selection.organizationId ||
        !selection.centerId ||
        (selection.organizationId === orgId && selection.centerId === centerId)
      )
        return;
      void navigate({
        to: "/o/$orgId/c/$centerId/centers",
        params: { orgId: selection.organizationId, centerId: selection.centerId },
        replace: true,
      });
    },
    [centerId, locked, navigate, orgId],
  );
  async function signOut() {
    if (locked || signingOut) return;
    setSigningOut(true);
    setSignOutFailed(false);
    const result = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (result.error) {
      setSignOutFailed(true);
      setSigningOut(false);
      return;
    }
    client.clear();
    await navigate({ to: "/login", replace: true });
    await router.invalidate();
  }
  return (
    <WorkspaceLayout
      accountId={account.id}
      name={account.display_name}
      pending={signingOut || locked}
      onSignOut={() => void signOut()}
      pageTitle={title}
      scopeControl={{
        organizationId,
        centerId: selectedCenter,
        locked,
        onResolved: resolved,
        onOrganization: (id) => {
          setOrganization(id);
          setCenter(undefined);
        },
        onCenter: setCenter,
      }}
    >
      {({ workspace, centerId: active, organizationId: selected }) => (
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
          <header>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-muted-foreground">{t(($) => $.businessCenters.description)}</p>
          </header>
          {signOutFailed && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
            </Alert>
          )}
          {workspace && selected === orgId && active === centerId ? (
            <BusinessCenterPanels
              scope={{ accountId: account.id, orgId, centerId }}
              centers={workspace.centers}
              roles={workspaceRoles(workspace, active)}
              personId={workspace.selected?.self_context?.person_id}
              onLockChange={setLocked}
            />
          ) : (
            <p role="status">{t(($) => $.studio.chooseScope)}</p>
          )}
        </div>
      )}
    </WorkspaceLayout>
  );
}

function BusinessCenterPanels({
  scope,
  centers,
  roles,
  personId,
  onLockChange,
}: {
  scope: ClientScope;
  centers: CenterView[];
  roles: ReturnType<typeof workspaceRoles>;
  personId?: string;
  onLockChange: (lock: boolean) => void;
}) {
  const { t } = useTranslation();
  const owner = roles.includes("owner");
  const orgManager = roles.includes("org_manager");
  const manages = owner || orgManager || roles.includes("center_manager");
  const plan = useQuery(
    owner
      ? settingsSubscriptionQuery(scope)
      : {
          queryKey: ["business-plan-inactive", scope.accountId],
          queryFn: skipToken,
        },
  );
  const data = plan.isError ? undefined : plan.data?.subscription;
  const feature = useQuery(
    !owner && manages
      ? businessWorkspaceQuery(scope)
      : {
          queryKey: ["business-feature-inactive", scope.accountId],
          queryFn: skipToken,
        },
  );
  const business = owner ? data?.plan === "business" : !feature.isError && feature.data === true;
  if ((owner && plan.isPending) || (!owner && manages && feature.isPending))
    return <p role="status">{t(($) => $.platform.loading)}</p>;
  if (!manages || !business || plan.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(($) => $.businessCenters.unavailable)}</AlertDescription>
      </Alert>
    );
  const max = data?.limits.entries.find((row) => row.key === "centers" && "value" in row);
  const usage = data?.usage.entries.find((row) => row.key === "centers")?.value;
  const hasQuota = max && "value" in max && usage !== undefined;
  const quotaReached = Boolean(hasQuota && usage >= max.value);
  const root = (center: string) => `/o/${scope.orgId}/c/${center}`;
  return (
    <>
      {(orgManager || (owner && hasQuota)) && (
        <BusinessCenterCreate
          scope={scope}
          quotaReached={quotaReached}
          onLockChange={onLockChange}
        />
      )}
      <Tabs defaultSelectedKey="centers" className="min-w-0">
        <div className="max-w-full overflow-x-auto pb-2">
          <TabsList aria-label={t(($) => $.businessCenters.sections)} variant="line">
            {sections.map((section) => (
              <TabsTrigger key={section} id={section} className="px-3">
                {t(($) => $.businessCenters.tabs[section])}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent id="centers">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.businessCenters.title)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasQuota && (
                <p>{t(($) => $.businessCenters.quota, { used: usage, max: max.value })}</p>
              )}
              <Table
                aria-label={t(($) => $.businessCenters.title)}
                scrollRegionLabel={t(($) => $.businessCenters.title)}
                className="min-w-[35rem]"
              >
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.businessCenters.center)}</TableHead>
                  <TableHead>{t(($) => $.businessCenters.timezone)}</TableHead>
                  <TableHead>{t(($) => $.businessCenters.state)}</TableHead>
                  <TableHead>{t(($) => $.businessCenters.actions)}</TableHead>
                </TableHeader>
                <TableBody items={centers}>
                  {(row) => (
                    <TableRow id={row.id}>
                      <TableCell className="max-w-48 whitespace-normal wrap-anywhere">
                        {row.name}
                      </TableCell>
                      <TableCell>{row.timezone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {t(($) =>
                            row.state === "active"
                              ? $.businessCenters.active
                              : $.businessCenters.inactive,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        <LinkButton
                          href={root(row.id) + "/settings?section=genel"}
                          size="sm"
                          variant="outline"
                        >
                          {t(($) => $.businessCenters.edit)}
                        </LinkButton>
                        <LinkButton href={root(row.id) + "/overview"} size="sm" variant="ghost">
                          {t(($) => $.businessCenters.open)}
                        </LinkButton>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {owner && (
                <LinkButton
                  href={root(scope.centerId) + "/settings?section=plan"}
                  variant="outline"
                >
                  {t(($) => $.businessCenters.plan)}
                </LinkButton>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {(["managers", "policies", "disciplines"] as const).map((section) => (
          <TabsContent key={section} id={section}>
            <BusinessCenterResources
              scope={scope}
              centers={centers}
              resource={section}
              organization={owner || orgManager}
            />
          </TabsContent>
        ))}
        <TabsContent id="people" className="space-y-3">
          {owner || orgManager ? (
            <BusinessPeople scope={scope} centers={centers} />
          ) : (
            <LinkButton href={root(scope.centerId) + "/people"} variant="outline">
              {t(($) => $.workspace.links.people)}
            </LinkButton>
          )}
          {roles.includes("center_manager") && <BusinessMergeSuggestions scope={scope} />}
        </TabsContent>
        <TabsContent id="applications">
          {owner || orgManager ? (
            <BusinessApplications scope={scope} centers={centers} onLockChange={onLockChange} />
          ) : (
            <LinkButton href={root(scope.centerId) + "/leads"} variant="outline">
              {t(($) => $.workspace.links.leads)}
            </LinkButton>
          )}
        </TabsContent>
        <TabsContent id="settlement">
          <div className="space-y-4">
            <BusinessSettlement
              scope={scope}
              centers={centers}
              personId={personId}
              owner={owner}
              onLockChange={onLockChange}
              authorityPanel={
                owner || orgManager ? (
                  <BusinessSettlementAuthority
                    scope={scope}
                    owner={owner}
                    onLockChange={onLockChange}
                  />
                ) : undefined
              }
            />
            <BusinessProductScope scope={scope} centers={centers} />
          </div>
        </TabsContent>
        <TabsContent id="reports">
          <BusinessReport scope={scope} centers={centers} aggregate={owner || orgManager} />
        </TabsContent>
      </Tabs>
    </>
  );
}
