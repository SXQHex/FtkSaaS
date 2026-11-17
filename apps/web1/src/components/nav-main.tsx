// Flat navigation groups composed from official @shadcn/sidebar-07.
import type { ReactNode } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
export function NavMain({
  title,
  items,
  className,
}: {
  title?: string;
  className?: string;
  items: { title: string; url?: string; icon: ReactNode; isActive?: boolean; count?: number }[];
}) {
  return (
    <SidebarGroup className={className ?? "gap-0.5 px-2 py-0"}>
      {title && (
        <SidebarGroupLabel className="h-auto px-2 pb-1 leading-[1.5] group-data-[collapsible=icon]:hidden">
          {title}
        </SidebarGroupLabel>
      )}
      <SidebarMenu className="group-data-[collapsible=icon]:items-center">
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              className="rounded-[6px] px-2 has-[>svg:first-child]:pl-2 has-[>svg:last-child]:pr-2"
              href={item.url ?? "#"}
              isDisabled={!item.url}
              isActive={item.isActive}
              aria-current={item.isActive ? "page" : undefined}
              tooltip={item.title}
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
            {item.count !== undefined && <SidebarMenuBadge>{item.count}</SidebarMenuBadge>}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
