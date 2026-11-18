// Page composition from official @shadcn/sidebar-07.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BellIcon, MoonIcon, UsersRoundIcon } from "lucide-react";
import { hasWorkspaceManagementScope, readWorkspace, workspaceRoles } from "./workspace";
import { workspaceQuery } from "./workspace-query";
import { workspaceNavigation, type NavigationView } from "./navigation";
import { NavigationSearch } from "./navigation-search";
import { BackendError } from "../../lib/backend";
import { AppSidebar } from "../../components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "../../components/ui/sidebar";
import { Button, LinkButton } from "../../components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Separator } from "../../components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
} from "../../components/ui/breadcrumb";
import { StateBanner } from "../states/state-view";
import { readSettingsSubscription } from "../settings/settings-subscription";
export interface WorkspaceSelection {
  organizationId?: string;
  centerId?: string;
}
export interface WorkspaceScopeControl extends WorkspaceSelection {
  locked?: boolean;
  onOrganization: (id: string) => void;
  onCenter: (id: string) => void;
  onResolved?: (selection: WorkspaceSelection) => void;
}
function NavigationTrigger() {
  const { t } = useTranslation();
  const { isMobile, openMobile, open } = useSidebar();
  return (
    <SidebarTrigger
      aria-label={t(($) => $.workspace.toggleNavigation)}
      aria-expanded={isMobile ? openMobile : open}
      aria-controls="workspace-sidebar"
    />
  );
}
export function WorkspaceLayout({
  accountId,
  name,
  pending,
  onSignOut,
  children,
  onThemeChange,
  scopeControl,
  scopeLocked = false,
  pageTitle,
}: {
  accountId: string;
  name: string;
  pending: boolean;
  onSignOut: () => void;
  children:
    | ReactNode
    | ((
        selection: WorkspaceSelection & { workspace?: Awaited<ReturnType<typeof readWorkspace>> },
      ) => ReactNode);
  scopeControl?: WorkspaceScopeControl;
  scopeLocked?: boolean;
  pageTitle?: string;
  onThemeChange?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [localOrganizationId, setOrganizationId] = useState<string>();
  const [localCenterId, setSelectedCenterId] = useState<string>();
  const organizationId = scopeControl ? scopeControl.organizationId : localOrganizationId;
  const selectedCenterId = scopeControl ? scopeControl.centerId : localCenterId;
  const [preferredView, setPreferredView] = useState<NavigationView>();
  const queries = useQueryClient();
  const scope = useQuery(workspaceQuery(queries, accountId, organizationId));
  useEffect(() => {
    const error = scope.error;
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      void router.invalidate();
  }, [scope.error, router]);
  const view = scope.isError && !scopeLocked ? undefined : scope.data;
  const centerId =
    (selectedCenterId && view?.centers.some((center) => center.id === selectedCenterId)
      ? selectedCenterId
      : undefined) ?? (view?.centers.length === 1 ? view.centers[0]?.id : undefined);
  const resolvedOrganizationId = view?.selected?.id;
  const onResolved = scopeControl?.onResolved;
  useEffect(() => {
    onResolved?.({ organizationId: resolvedOrganizationId, centerId });
  }, [onResolved, resolvedOrganizationId, centerId]);
  const roles = workspaceRoles(view, centerId);
  const modes: NavigationView[] = [];
  if (roles.some((role) => ["owner", "org_manager", "center_manager", "staff"].includes(role)))
    modes.push("management");
  const instructor =
    roles.includes("instructor") ||
    Boolean(
      view?.selected?.self_context?.centers.some(
        (center) => center.center_id === centerId && center.instructor,
      ),
    );
  if (instructor) modes.push("instructor");
  if (!modes.length) modes.push("account");
  const mode =
    preferredView && modes.includes(preferredView)
      ? preferredView
      : pathname.startsWith("/instructor/") && modes.includes("instructor")
        ? "instructor"
        : (modes[0] ?? "account");
  const ownerScope =
    !scope.isError && resolvedOrganizationId && centerId && roles.includes("owner")
      ? { accountId, orgId: resolvedOrganizationId, centerId }
      : undefined;
  const subscription = useQuery({
    queryKey: ["settings-subscription", accountId, ownerScope?.orgId],
    queryFn: ownerScope ? () => readSettingsSubscription(ownerScope) : skipToken,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const starter =
    !!ownerScope && !subscription.isError && subscription.data?.subscription.plan === "starter";
  const groups = workspaceNavigation(mode, resolvedOrganizationId, centerId, starter);
  const memberSearchScope =
    mode === "management" &&
    view?.selected?.id &&
    centerId &&
    !scope.isError &&
    !scopeLocked &&
    !scopeControl?.locked
      ? { accountId, orgId: view.selected.id, centerId }
      : undefined;
  const manager =
    memberSearchScope && hasWorkspaceManagementScope(view, memberSearchScope.centerId);
  const settingsUrl = manager
    ? groups.find((group) => group.key === "studio")?.items.find((item) => item.key === "settings")
        ?.url
    : undefined;
  const roleNames = roles.map((role) => t(($) => $.workspace.roles[role]));
  if (instructor) roleNames.push(t(($) => $.workspace.roles.instructor));
  const roleLabel = roleNames.length
    ? [...new Set(roleNames)].join(", ")
    : t(($) => $.auth.account);
  const caption = t(($) => $.workspace.views[mode]);
  const chooseMode = (value: string) => {
    if (scopeLocked || scopeControl?.locked) return;
    if (value === "management" || value === "instructor" || value === "account")
      setPreferredView(value);
  };
  return (
    <SidebarProvider style={{ "--sidebar-width-icon": "3.5rem" } as CSSProperties}>
      <AppSidebar
        key={accountId}
        name={name}
        pending={pending}
        scopeLocked={scopeLocked || scopeControl?.locked}
        onSignOut={onSignOut}
        view={view}
        loading={scope.isPending}
        failed={scope.isError}
        onRefresh={() => void scope.refetch()}
        centerId={centerId}
        onOrganization={(id) => {
          if (scopeLocked || scopeControl?.locked) return;
          if (scopeControl) scopeControl.onOrganization(id);
          else {
            setOrganizationId(id);
            setSelectedCenterId(undefined);
          }
          setPreferredView(undefined);
        }}
        onCenter={(id) => {
          if (scopeLocked || scopeControl?.locked) return;
          if (scopeControl) scopeControl.onCenter(id);
          else setSelectedCenterId(id);
          setPreferredView(undefined);
        }}
        groups={groups}
        roleLabel={roleLabel}
        pathname={pathname}
      />
      <SidebarInset className="min-w-0">
        <header className="workspace-topbar @container/workspace sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <NavigationTrigger />
          <Separator
            orientation="vertical"
            className="mx-1 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb
            className="hidden min-w-0 flex-1 min-[361px]:block"
            aria-label={t(($) => $.workspace.breadcrumb)}
          >
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem className="hidden @min-[901px]/workspace:inline-flex">
                <BreadcrumbLink href={groups[0]?.items[0]?.url}>{caption}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="block min-w-0 truncate">
                  {pageTitle ?? t(($) => $.auth.account)}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {modes.length > 1 && (
              <>
                <ToggleGroup
                  className="flex shrink-0"
                  variant="segmented"
                  size="segmented"
                  selectionMode="single"
                  disallowEmptySelection
                  isDisabled={scopeLocked || scopeControl?.locked}
                  selectedKeys={new Set([mode])}
                  aria-label={t(($) => $.workspace.viewMode)}
                  onSelectionChange={(keys) => {
                    const first = [...keys][0];
                    if (typeof first === "string") chooseMode(first);
                  }}
                >
                  {modes.map((value) => (
                    <ToggleGroupItem
                      className="h-[26px] px-2 text-[0.8125rem] min-[641px]:px-2.5"
                      key={value}
                      id={value}
                    >
                      {t(($) => $.workspace.viewLabels[value])}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </>
            )}
            <div className="hidden min-[641px]:inline-flex">
              <NavigationSearch
                settingsUrl={settingsUrl}
                memberScope={memberSearchScope}
                showActions={
                  !pending && !scopeLocked && !scopeControl?.locked && mode === "management"
                }
                managementActions={Boolean(manager)}
                onThemeChange={onThemeChange}
                onSignOut={onSignOut}
                groups={[
                  ...groups,
                  {
                    key: "personal",
                    items: [
                      ...(groups.some((group) => group.items.some((item) => item.key === "account"))
                        ? []
                        : [{ key: "account" as const, url: "/account", icon: <UsersRoundIcon /> }]),
                      { key: "help", url: "/help", icon: <UsersRoundIcon /> },
                    ],
                  },
                ]}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t(($) => $.workspace.changeTheme)}
              isDisabled={!onThemeChange}
              onPress={onThemeChange}
            >
              <MoonIcon />
            </Button>
            <LinkButton
              href="/inbox"
              variant="ghost"
              size="icon-sm"
              aria-label={t(($) => $.workspace.notifications)}
            >
              <BellIcon />
            </LinkButton>
          </div>
        </header>
        {view?.selected?.access_mode === "closed" && <StateBanner kind="readOnly" />}
        {typeof children === "function"
          ? children({ organizationId: resolvedOrganizationId, centerId, workspace: view })
          : children}
      </SidebarInset>
    </SidebarProvider>
  );
}
