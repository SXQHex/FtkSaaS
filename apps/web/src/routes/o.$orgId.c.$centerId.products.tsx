import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ProductsRoutePage } from "../features/products/products-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/products")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: ProductsRoutePage,
  errorComponent: AccountErrorPage,
});
