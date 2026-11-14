import type common from "../../locales/tr/common.json";
import type { ReactNode } from "react";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  SparklesIcon,
  UsersIcon,
  TargetIcon,
  ZapIcon,
  InboxIcon,
  ClockIcon,
  PackageIcon,
  CreditCardIcon,
  WalletIcon,
  ChartNoAxesCombinedIcon,
  Building2Icon,
  FileTextIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  UserIcon,
} from "lucide-react";
export type NavigationView = "management" | "instructor" | "account";
export type NavigationKey = keyof typeof common.workspace.links;
export interface NavigationItem {
  key: NavigationKey;
  url?: string;
  icon: ReactNode;
}
export interface NavigationGroup {
  key: keyof typeof common.workspace.groups;
  items: NavigationItem[];
}
export function workspaceNavigation(
  view: NavigationView,
  orgId?: string,
  centerId?: string,
): NavigationGroup[] {
  const base =
    orgId && centerId
      ? `/o/${encodeURIComponent(orgId)}/c/${encodeURIComponent(centerId)}`
      : undefined;
  const scoped = (path: string) => (base ? `${base}/${path}` : undefined);
  if (view === "instructor")
    return [
      {
        key: "work",
        items: [
          { key: "today", url: "/instructor/today", icon: <LayoutDashboardIcon /> },
          { key: "mySchedule", url: "/instructor/schedule", icon: <CalendarDaysIcon /> },
          { key: "myEarnings", url: "/instructor/earnings", icon: <WalletIcon /> },
        ],
      },
    ];
  if (view === "account")
    return [{ key: "general", items: [{ key: "account", url: "/account", icon: <UserIcon /> }] }];
  return [
    {
      key: "general",
      items: [
        { key: "overview", url: scoped("overview"), icon: <LayoutDashboardIcon /> },
        { key: "schedule", url: scoped("schedule"), icon: <CalendarDaysIcon /> },
        { key: "events", url: scoped("events"), icon: <SparklesIcon /> },
        { key: "people", url: scoped("people"), icon: <UsersIcon /> },
        { key: "leads", url: scoped("leads"), icon: <TargetIcon /> },
        { key: "automation", url: scoped("automation"), icon: <ZapIcon /> },
        { key: "inbox", url: "/inbox", icon: <InboxIcon /> },
        { key: "requests", url: scoped("requests"), icon: <ClockIcon /> },
      ],
    },
    {
      key: "sales",
      items: [
        { key: "products", url: scoped("products"), icon: <PackageIcon /> },
        { key: "finance", url: scoped("finance"), icon: <CreditCardIcon /> },
        { key: "earnings", url: scoped("earnings"), icon: <WalletIcon /> },
        { key: "reports", url: scoped("reports"), icon: <ChartNoAxesCombinedIcon /> },
      ],
    },
    {
      key: "studio",
      items: [
        { key: "studio", url: scoped("studio"), icon: <Building2Icon /> },
        { key: "documents", url: scoped("documents"), icon: <FileTextIcon /> },
        { key: "audit", url: scoped("audit"), icon: <ShieldIcon /> },
        { key: "settings", url: scoped("settings"), icon: <SlidersHorizontalIcon /> },
      ],
    },
  ];
}
