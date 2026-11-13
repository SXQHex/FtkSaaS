import { lazy, Suspense } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAuthSession } from "../features/auth/use-auth-session";
import { Skeleton } from "./ui/skeleton";

const isDevelopment = import.meta.env.DEV && import.meta.env.MODE === "development";
const Devtools = isDevelopment ? lazy(() => import("./devtools")) : () => null;
const FormPreview = isDevelopment ? lazy(() => import("../examples/form-preview")) : () => null;

export function RootLayout() {
  const authReady = useAuthSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const publicRoute = [
    "/",
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/auth/callback",
  ].includes(pathname);
  const showExample =
    isDevelopment && new URLSearchParams(window.location.search).has("__form_example");
  return (
    <>
      <Suspense fallback={null}>
        {!authReady && !publicRoute ? (
          <Skeleton className="mx-auto mt-24 h-48 w-80" />
        ) : showExample ? (
          <FormPreview />
        ) : (
          <Outlet />
        )}
      </Suspense>
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    </>
  );
}
