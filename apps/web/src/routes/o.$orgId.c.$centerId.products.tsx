import { workspacePanel, PanelError, PanelPending } from "../features/workspace/panel-routes";
import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { ProductsRoutePage } from "../features/products/products-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/products")({
  staticData: workspacePanel,
  pendingComponent: PanelPending,
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: ProductsRoutePage,
  errorComponent: PanelError,
});
