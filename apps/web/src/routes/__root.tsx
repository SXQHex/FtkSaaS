import { createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { RootLayout } from "../components/root-layout";

import {
  RouteErrorPage,
  RouteNotFoundPage,
  RoutePendingPage,
} from "../features/states/route-state-pages";
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  errorComponent: RouteErrorPage,
  notFoundComponent: RouteNotFoundPage,
  pendingComponent: RoutePendingPage,
});
