import { I18nProvider, RouterProvider as AriaRouterProvider } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useAuthSession } from "../features/auth/use-auth-session";
import { observeQueryAccessFailures } from "../features/auth/query-access-recovery";
import { RoutePendingPage } from "../features/states/route-state-pages";
import { StateView } from "../features/states/state-view";
import { NetworkNotice } from "../features/states/network-notice";

const isDevelopment = import.meta.env.DEV && import.meta.env.MODE === "development";
const Devtools = isDevelopment ? lazy(() => import("./devtools")) : () => null;
const FormPreview = isDevelopment ? lazy(() => import("../examples/form-preview")) : () => null;

const StateGallery = isDevelopment ? lazy(() => import("../examples/state-gallery")) : () => null;

export function RootLayout() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [sameActorHandoff, setSameActorHandoff] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const anonymousProgram = pathname.startsWith("/public/");
  const authReady = useAuthSession(!anonymousProgram, setSameActorHandoff);
  const publicRoute =
    anonymousProgram ||
    ["/", "/login", "/signup", "/verify-email", "/forgot-password", "/auth/callback"].includes(
      pathname,
    );
  useEffect(() => {
    if (publicRoute) return;
    return observeQueryAccessFailures(queries, {
      onChecking: setCheckingAccess,
      invalidateRoute: () => router.invalidate({ sync: true }),
      showLogin: () => router.navigate({ to: "/login", replace: true }),
    });
  }, [publicRoute, queries, router]);
  const privateAuthPending = !authReady && !publicRoute;
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
          className={preserveCommandTree ? "invisible" : "contents"}
          inert={(checkingAccess || privateAuthPending) && !publicRoute}
          aria-hidden={(checkingAccess || privateAuthPending) && !publicRoute}
        >
          <Suspense fallback={<RoutePendingPage />}>
            {privateAuthPending && !preserveCommandTree ? (
              <RoutePendingPage />
            ) : showStates ? (
              <StateGallery />
            ) : showExample ? (
              <FormPreview />
            ) : (
              <Outlet />
            )}
          </Suspense>
        </div>
        {(checkingAccess || preserveCommandTree) && !publicRoute && (
          <div className="fixed inset-0 z-50 bg-background">
            <StateView kind="loading" />
          </div>
        )}
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      </AriaRouterProvider>
    </I18nProvider>
  );
}
