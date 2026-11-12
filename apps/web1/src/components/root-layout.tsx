import { lazy, Suspense } from "react";
import { Outlet } from "@tanstack/react-router";

const isDevelopment = import.meta.env.DEV && import.meta.env.MODE === "development";
const Devtools = isDevelopment ? lazy(() => import("./devtools")) : () => null;
const FormPreview = isDevelopment ? lazy(() => import("../examples/form-preview")) : () => null;

export function RootLayout() {
  const showExample =
    isDevelopment && new URLSearchParams(window.location.search).has("__form_example");
  return (
    <>
      <Suspense fallback={null}>{showExample ? <FormPreview /> : <Outlet />}</Suspense>
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    </>
  );
}
