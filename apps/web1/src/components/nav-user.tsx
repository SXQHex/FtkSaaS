// Adapted from @shadcn/sidebar-07; only implemented account actions are exposed.
import { ChevronsUpDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
export function NavUser({
  name,
  detail,
  pending,
  onSignOut,
}: {
  name: string;
  detail: string;
  pending: boolean;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("");
  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenuTrigger>
          <SidebarMenuButton className="px-2" size="lg">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs">{detail}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </SidebarMenuButton>
          <DropdownMenu
            placement={isMobile ? "bottom end" : "right bottom"}
            offset={4}
            aria-label={t(($) => $.workspace.accountMenu)}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem href="/account">
                <UserIcon />
                {t(($) => $.auth.account)}
              </DropdownMenuItem>
              <DropdownMenuItem isDisabled={pending} onAction={onSignOut}>
                <LogOutIcon />
                {t(($) => $.auth.signout)}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenu>
        </DropdownMenuTrigger>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
