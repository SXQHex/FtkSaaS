// Adapted from @shadcn/sidebar-07 (aria-rhea), installed by the official CLI.
import { ChevronsUpDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { OrganizationView, CenterView } from "@/lib/api-contracts/generated";
export function TeamSwitcher({
  organizations,
  selected,
  centers,
  centerId,
  onOrganization,
  disabled = false,
  onCenter,
}: {
  organizations: OrganizationView[];
  selected?: OrganizationView;
  centers: CenterView[];
  centerId?: string;
  disabled?: boolean;
  onOrganization: (id: string) => void;
  onCenter: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const center = centers.find((c) => c.id === centerId);
  const label =
    selected?.name ??
    (organizations.length
      ? t(($) => $.workspace.chooseOrganization)
      : t(($) => $.workspace.noOrganization));
  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenuTrigger>
          <SidebarMenuButton
            className="px-2"
            size="lg"
            isDisabled={disabled || organizations.length === 0}
          >
            <div
              data-workspace-logo
              className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-[8px] bg-primary text-xs font-semibold text-primary-foreground"
            >
              {label
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => Array.from(part)[0])
                .join("")}
            </div>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{label}</span>
              <span className="truncate text-xs">
                {center?.name ?? t(($) => $.workspace.chooseCenter)}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </SidebarMenuButton>
          <DropdownMenu
            placement={isMobile ? "bottom start" : "right top"}
            offset={4}
            aria-label={t(($) => $.workspace.switchScope)}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t(($) => $.workspace.organizations)}</DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem key={org.id} id={org.id} onAction={() => onOrganization(org.id)}>
                  {org.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {centers.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t(($) => $.workspace.centers)}</DropdownMenuLabel>
                {centers.map((item) => (
                  <DropdownMenuItem key={item.id} id={item.id} onAction={() => onCenter(item.id)}>
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
          </DropdownMenu>
        </DropdownMenuTrigger>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
