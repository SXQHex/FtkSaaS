import { PanelOutlet } from "./panel-outlet";
import {
  Dialog,
  I18nProvider,
  Modal,
  ModalOverlay,
  RouterProvider as AriaRouterProvider,
} from "react-aria-components";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";
import { useTranslation } from "react-i18next";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useAuthSession } from "../features/auth/use-auth-session";
import { calendarSessionReturn } from "../features/auth/calendar-session-return";
import { PrivateSessionRevision } from "../features/auth/private-session-revision";
import { observeQueryAccessFailures } from "../features/auth/query-access-recovery";
import { RoutePendingPage } from "../features/states/route-state-pages";
import { StateView } from "../features/states/state-view";
import { NetworkNotice } from "../features/states/network-notice";

const isDevelopment = import.meta.env.DEV && import.meta.env.MODE === "development";
const Devtools = isDevelopment ? lazy(() => import("./devtools")) : () => null;
const FormPreview = isDevelopment ? lazy(() => import("../examples/form-preview")) : () => null;

const StateGallery = isDevelopment ? lazy(() => import("../examples/state-gallery")) : () => null;

export function RootLayout() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [sameActorHandoff, setSameActorHandoff] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const anonymousProgram = pathname.startsWith("/public/");
  const onSessionHandoff = useCallback((pending: boolean) => {
    setSameActorHandoff(pending);
    if (pending) setSessionRevision((value) => value + 1);
  }, []);
  const authReady = useAuthSession(!anonymousProgram, onSessionHandoff);
  // These screens have no domain account Query; MFA/recovery still enforce
  // native session and assurance in their own Router beforeLoad guards.
  const unscopedRoute =
    anonymousProgram ||
    [
      "/",
      "/login",
      "/signup",
      "/verify-email",
      "/forgot-password",
      "/auth/callback",
      "/mfa",
      "/reset-password",
    ].includes(pathname);
  useEffect(() => {
    if (unscopedRoute) return;
    return observeQueryAccessFailures(queries, {
      onChecking: setCheckingAccess,
      invalidateRoute: () => router.invalidate({ sync: true }),
      showLogin: () => {
        const next = calendarSessionReturn(router.latestLocation.pathname);
        return router.navigate({
          to: "/login",
          ...(next ? { search: { next } } : {}),
          replace: true,
        });
      },
    });
  }, [unscopedRoute, queries, router]);
  const privateAuthPending = !authReady && !unscopedRoute;
  const privatePresentationHidden = (checkingAccess || privateAuthPending) && !unscopedRoute;
  // Preserve in-flight native commands without exposing any old private UI.
  // Queries were already evicted and Router guards must finish before reveal.
  const preserveCommandTree = privateAuthPending && sameActorHandoff;
  const showExample =
    isDevelopment && new URLSearchParams(window.location.search).has("__form_example");
  const showStates =
    isDevelopment && new URLSearchParams(window.location.search).has("__states_example");
  return (
    <I18nProvider locale={i18n.resolvedLanguage ?? i18n.language}>
      <AriaRouterProvider
        navigate={(href) => {
          const url = new URL(href, window.location.href);
          void router.navigate({ href: `${url.pathname}${url.search}${url.hash}` });
        }}
      >
        <NetworkNotice />
        <div
          className="contents"
          style={{ display: privatePresentationHidden ? "none" : undefined }}
          inert={privatePresentationHidden}
          aria-hidden={privatePresentationHidden}
        >
          <UNSAFE_PortalProvider getContainer={() => portalContainer}>
            {portalContainer && (
              <Suspense fallback={<RoutePendingPage />}>
                {privateAuthPending && !preserveCommandTree ? (
                  <RoutePendingPage />
                ) : showStates ? (
                  <StateGallery />
                ) : showExample ? (
                  <FormPreview />
                ) : (
                  <PrivateSessionRevision value={sessionRevision}>
                    <PanelOutlet>
                      <Outlet />
                    </PanelOutlet>
                  </PrivateSessionRevision>
                )}
              </Suspense>
            )}
          </UNSAFE_PortalProvider>
          {/* Mount open overlays only once their native focus/aria hooks have a connected host. */}
          <div ref={setPortalContainer} className="contents" />
        </div>
        <ModalOverlay
          isOpen={privatePresentationHidden}
          isDismissable={false}
          isKeyboardDismissDisabled
          className="fixed inset-0 z-50 bg-background"
        >
          <Modal className="size-full outline-none">
            <Dialog
              aria-label={t(($) => $.states.content.loading.title)}
              className="size-full outline-none"
            >
              <StateView kind="loading" />
            </Dialog>
          </Modal>
        </ModalOverlay>
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      </AriaRouterProvider>
    </I18nProvider>
  );
}
