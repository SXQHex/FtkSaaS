import { lazy, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import type { PanelRoute } from "../features/workspace/panel-context";

const ActivePanel = lazy(() =>
  import("../features/workspace/panel-frame").then((module) => ({ default: module.ActivePanel })),
);

export function PanelOutlet({ children }: { children: ReactNode }) {
  const panel = useRouterState({
    select: ({ matches }) => {
      const match = matches.at(-1);
      const panel = match?.staticData.panel;
      if (!match || !panel) return;
      const kind =
        panel === "inbox"
          ? "view" in match.search && match.search.view === "member"
            ? "member"
            : "workspace"
          : panel;
      const org =
        "orgId" in match.params
          ? match.params.orgId
          : "org" in match.search
            ? match.search.org
            : undefined;
      const center =
        "centerId" in match.params
          ? match.params.centerId
          : "center" in match.search
            ? match.search.center
            : undefined;
      return { id: match.id, kind, organizationId: org, centerId: center } satisfies PanelRoute;
    },
    structuralSharing: true,
  });
  return panel ? (
    <ActivePanel key={panel.kind} route={panel}>
      {children}
    </ActivePanel>
  ) : (
    children
  );
}
