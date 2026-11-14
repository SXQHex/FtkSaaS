import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { I18nProvider } from "react-aria-components/I18nProvider";

import { i18n } from "./i18n";
import { captureAuthCallback } from "./features/auth/callback";
import { captureInvitation } from "./features/invitations/invitation";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

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
window.addEventListener("hashchange", captureInvitationNavigation, { capture: true });

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
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
