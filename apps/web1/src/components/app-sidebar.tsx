// Composition from official @shadcn/sidebar-07 (aria-rhea).
import { useTranslation } from "react-i18next";
import { XIcon, CircleHelpIcon } from "lucide-react";
import type { readWorkspace } from "@/features/workspace/workspace";
import type { NavigationGroup } from "@/features/workspace/navigation";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
export function AppSidebar({
  name,
  pending,
  onSignOut,
  view,
  loading,
  failed,
  onRefresh,
  centerId,
  onOrganization,
  onCenter,
  groups,
  roleLabel,
  pathname,
}: {
  name: string;
  pending: boolean;
  onSignOut: () => void;
  view?: Awaited<ReturnType<typeof readWorkspace>>;
  loading: boolean;
  failed: boolean;
  onRefresh: () => void;
  centerId?: string;
  onOrganization: (id: string) => void;
  onCenter: (id: string) => void;
  groups: NavigationGroup[];
  roleLabel: string;
  pathname: string;
}) {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar
      id="workspace-sidebar"
      collapsible="icon"
      mobileTitle={t(($) => $.workspace.navigation)}
      mobileDescription={t(($) => $.workspace.navigationDescription)}
    >
      <SidebarHeader className="pb-1">
        {isMobile && (
          <Button
            autoFocus
            variant="ghost"
            size="icon-sm"
            aria-label={t(($) => $.workspace.closeNavigation)}
            onPress={() => setOpenMobile(false)}
          >
            <XIcon />
          </Button>
        )}
        {loading && <Skeleton className="h-12 w-full" />}
        {view && (
          <TeamSwitcher
            organizations={view.organizations}
            selected={view.selected}
            centers={view.centers}
            centerId={centerId}
            onOrganization={onOrganization}
            onCenter={onCenter}
          />
        )}
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.workspace.readFailed)}
              <Button variant="outline" size="sm" onPress={onRefresh}>
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label={t(($) => $.workspace.navigation)} className="flex flex-col gap-4 py-2">
          {groups.map((group) => (
            <NavMain
              key={group.key}
              title={t(($) => $.workspace.groups[group.key])}
              items={group.items.map((item) => ({
                title: t(($) => $.workspace.links[item.key]),
                url: item.url,
                icon: item.icon,
                isActive: pathname === item.url,
              }))}
            />
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-0 border-t p-2">
        <nav aria-label={t(($) => $.workspace.links.help)}>
          <NavMain
            className="p-0"
            items={[
              { title: t(($) => $.workspace.links.help), url: "/help", icon: <CircleHelpIcon /> },
            ]}
          />
        </nav>
        <NavUser name={name} detail={roleLabel} pending={pending} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail
        aria-label={t(($) => $.workspace.toggleNavigation)}
        title={t(($) => $.workspace.toggleNavigation)}
      />
    </Sidebar>
  );
}
