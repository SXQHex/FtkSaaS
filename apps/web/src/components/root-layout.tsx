import { I18nProvider, RouterProvider as AriaRouterProvider } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useAuthSession } from "../features/auth/use-auth-session";
import { observeQueryAccessFailures } from "../features/auth/query-access-recovery";
import { RoutePendingPage } from "../features/states/route-state-pages";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const anonymousProgram = pathname.startsWith("/public/");
  const authReady = useAuthSession(!anonymousProgram);
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
          className={
            checkingAccess && !publicRoute ? "invisible pointer-events-none contents" : "contents"
          }
          inert={checkingAccess && !publicRoute}
          aria-hidden={checkingAccess && !publicRoute}
        >
          <Suspense fallback={<RoutePendingPage />}>
            {!authReady && !publicRoute ? (
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
        {checkingAccess && !publicRoute && (
          <div className="fixed inset-0 z-50 bg-background">
            <RoutePendingPage />
          </div>
        )}
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      </AriaRouterProvider>
    </I18nProvider>
  );
}
