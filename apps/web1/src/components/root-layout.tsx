import { I18nProvider } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAuthSession } from "../features/auth/use-auth-session";
import { RoutePendingPage } from "../features/states/route-state-pages";
import { NetworkNotice } from "../features/states/network-notice";

const isDevelopment = import.meta.env.DEV && import.meta.env.MODE === "development";
const Devtools = isDevelopment ? lazy(() => import("./devtools")) : () => null;
const FormPreview = isDevelopment ? lazy(() => import("../examples/form-preview")) : () => null;

const StateGallery = isDevelopment ? lazy(() => import("../examples/state-gallery")) : () => null;

export function RootLayout() {
  const { i18n } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const anonymousProgram = pathname.startsWith("/public/");
  const authReady = useAuthSession(!anonymousProgram);
  const publicRoute =
    anonymousProgram ||
    ["/", "/login", "/signup", "/verify-email", "/forgot-password", "/auth/callback"].includes(
      pathname,
    );
  const showExample =
    isDevelopment && new URLSearchParams(window.location.search).has("__form_example");
  const showStates =
    isDevelopment && new URLSearchParams(window.location.search).has("__states_example");
  return (
    <I18nProvider locale={i18n.resolvedLanguage ?? i18n.language}>
      <NetworkNotice />
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
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    </I18nProvider>
  );
}
