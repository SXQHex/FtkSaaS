import {
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@ftksaas/ui/components/sidebar";
import { PanelPending } from "../states/route-state-pages";
import { MemberShellView } from "../member/member-shell-view";
import type { WorkspaceSelection } from "./workspace-layout";

import {
  PanelContext,
  type WorkspaceChrome,
  type MemberChrome,
  type PanelRoute,
  type Registration,
  type PreferredView,
  type RenderChrome,
} from "./panel-context";

function CloseMobileNavigation({ routeKey }: { routeKey?: string }) {
  const { setOpenMobile } = useSidebar();
  useLayoutEffect(() => {
    if (routeKey) setOpenMobile(false);
  }, [routeKey, setOpenMobile]);
  return null;
}

export function WorkspaceFrame({
  chrome,
  routeKey,
  children,
}: {
  chrome?: WorkspaceChrome;
  routeKey?: string;
  children: ReactNode;
}) {
  return (
    <SidebarProvider style={{ "--sidebar-width-icon": "3.5rem" } as CSSProperties}>
      <CloseMobileNavigation routeKey={routeKey} />
      {chrome?.sidebar}
      <SidebarInset className="min-w-0">
        {chrome?.toolbar}
        {chrome?.banner}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export function MemberFrame({
  chrome,
  contentKey,
  children,
}: {
  chrome?: MemberChrome;
  contentKey?: string;
  children: ReactNode;
}) {
  return (
    <MemberShellView
      contentKey={contentKey}
      brand={chrome?.brand ?? ""}
      subtitle={chrome?.subtitle ?? ""}
      navigationLabel={chrome?.navigationLabel ?? ""}
      links={chrome?.links ?? []}
      actions={chrome?.actions}
      linksDisabled={chrome?.linksDisabled}
    >
      {chrome?.scopeSelectors}
      {children}
    </MemberShellView>
  );
}

export function ActivePanel({ route, children }: { route: PanelRoute; children: ReactNode }) {
  const [registration, setRegistration] = useState<Registration>();
  const [preference, setPreference] = useState<PreferredView>();
  const attach = useCallback(
    (owner: string, route: PanelRoute, selection: WorkspaceSelection, render: RenderChrome) => {
      setRegistration({ owner, route, selection, attached: true, render });
    },
    [],
  );
  const detach = useCallback((owner: string) => {
    setRegistration((last) => (last?.owner === owner ? { ...last, attached: false } : last));
  }, []);
  const context = useMemo(
    () => ({ route, preference, setPreference, attach, detach }),
    [route, preference, attach, detach],
  );
  // During a child load the last verified shell can stay visible in this scope.
  // Leaf-owned controls are inactive until the new child supplies its callbacks.
  const active = registration?.route === route && registration.attached;
  const sameScope =
    (!route.organizationId || registration?.selection.organizationId === route.organizationId) &&
    (!route.centerId || registration?.selection.centerId === route.centerId);
  const chrome = active || sameScope ? registration?.render(active) : undefined;
  const content = <Suspense fallback={<PanelPending />}>{children}</Suspense>;
  return (
    <PanelContext value={context}>
      {route.kind === "workspace" ? (
        <WorkspaceFrame
          routeKey={route.id}
          chrome={chrome?.kind === "workspace" ? chrome : undefined}
        >
          {content}
        </WorkspaceFrame>
      ) : (
        <MemberFrame chrome={chrome?.kind === "member" ? chrome : undefined} contentKey={route.id}>
          {content}
        </MemberFrame>
      )}
    </PanelContext>
  );
}
