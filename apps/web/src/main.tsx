import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouteMask, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { I18nProvider } from "react-aria-components/I18nProvider";

import { i18n } from "./i18n";
import { captureAuthCallback } from "./features/auth/callback";
import { captureInvitation } from "./features/invitations/invitation";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query-client";
import { workspaceKeys } from "./features/workspace/workspace-query";
import "./index.css";

captureAuthCallback();
captureInvitation();
// Hash-only navigation can reuse this document. Scrub before Router history listeners
// observe it, then remount with the captured private invitation rather than a URL token.
function captureInvitationNavigation() {
  if (window.location.pathname !== "/invite" || !window.location.hash) return;
  captureInvitation();
  window.location.reload();
}
window.addEventListener("popstate", captureInvitationNavigation, { capture: true });
// History must never re-expose a formerly authorized center from a warm Query
// projection. Mark it stale synchronously before Router processes popstate.
window.addEventListener(
  "popstate",
  () => {
    const pathOrganization = window.location.pathname.match(/^\/o\/([^/]+)\/c\//)?.[1];
    let organizationId: string | undefined;
    try {
      if (pathOrganization) organizationId = decodeURIComponent(pathOrganization);
    } catch {
      // An unrecognized destination keeps the conservative history fallback.
    }
    void queryClient.invalidateQueries({
      queryKey: workspaceKeys.all(),
      predicate: ({ queryKey }) =>
        !organizationId || queryKey[2] === organizationId || queryKey[2] === null,
      refetchType: "none",
    });
  },
  { capture: true },
);
window.addEventListener("hashchange", captureInvitationNavigation, { capture: true });

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  routeMasks: [
    createRouteMask({
      routeTree,
      from: "/o/$orgId/c/$centerId/reports",
      to: "/reports",
      search: {},
    }),
  ],
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <I18nProvider locale="tr-TR">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nProvider>
    </I18nextProvider>
  </StrictMode>,
);
