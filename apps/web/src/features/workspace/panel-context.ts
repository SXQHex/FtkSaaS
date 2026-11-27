import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import type { MemberShellView } from "../member/member-shell-view";
import type { NavigationView } from "./navigation";
import type { WorkspaceSelection } from "./workspace-layout";

export type WorkspaceChrome = {
  sidebar: ReactNode;
  toolbar: ReactNode;
  banner: ReactNode;
};
export type MemberChrome = Omit<
  ComponentProps<typeof MemberShellView>,
  "children" | "contentKey"
> & {
  scopeSelectors: ReactNode;
};
type PanelKind = "workspace" | "member";
export type PanelRoute = WorkspaceSelection & { kind: PanelKind; id: string };
type Chrome = ({ kind: "workspace" } & WorkspaceChrome) | ({ kind: "member" } & MemberChrome);
export type RenderChrome = (interactive: boolean) => Chrome;
export type Registration = {
  owner: string;
  route: PanelRoute;
  selection: WorkspaceSelection;
  attached: boolean;
  render: RenderChrome;
};
export type PreferredView = { scope: string; view: NavigationView };
export const PanelContext = createContext<{
  route: PanelRoute;
  attach: (
    owner: string,
    route: PanelRoute,
    selection: WorkspaceSelection,
    render: RenderChrome,
  ) => void;
  detach: (owner: string) => void;
  preference?: PreferredView;
  setPreference: (preference: PreferredView | undefined) => void;
} | null>(null);

export function usePanelChrome(
  kind: PanelKind,
  selection: WorkspaceSelection,
  render: RenderChrome,
) {
  const panel = useContext(PanelContext);
  const owner = useId();
  const attach = panel?.route.kind === kind ? panel.attach : undefined;
  const detach = panel?.route.kind === kind ? panel.detach : undefined;
  const route = panel?.route;
  useLayoutEffect(() => {
    if (route) attach?.(owner, route, selection, render);
  });
  useLayoutEffect(() => () => detach?.(owner), [detach, owner]);
  return !!attach;
}

export function usePanelView(accountId: string, orgId?: string, centerId?: string) {
  const panel = useContext(PanelContext);
  const [localView, setLocalView] = useState<NavigationView>();
  const scope = JSON.stringify([accountId, orgId, centerId]);
  const view = panel
    ? panel.preference?.scope === scope
      ? panel.preference.view
      : undefined
    : localView;
  return [
    view,
    (next: NavigationView | undefined) => {
      if (panel) panel.setPreference(next ? { scope, view: next } : undefined);
      else setLocalView(next);
    },
  ] as const;
}
