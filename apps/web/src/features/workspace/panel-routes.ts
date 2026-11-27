import type { StaticDataRouteOption } from "@tanstack/react-router";
export { PanelError, PanelPending } from "../states/route-state-pages";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    panel?: "workspace" | "member" | "inbox";
  }
}

export const workspacePanel = { panel: "workspace" } satisfies StaticDataRouteOption;
export const memberPanel = { panel: "member" } satisfies StaticDataRouteOption;
export const inboxPanel = { panel: "inbox" } satisfies StaticDataRouteOption;
