import { createRootRoute } from "@tanstack/react-router";
import { RootLayout } from "../components/root-layout";

import {
  RouteErrorPage,
  RouteNotFoundPage,
  RoutePendingPage,
} from "../features/states/route-state-pages";
export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RouteErrorPage,
  notFoundComponent: RouteNotFoundPage,
  pendingComponent: RoutePendingPage,
});
