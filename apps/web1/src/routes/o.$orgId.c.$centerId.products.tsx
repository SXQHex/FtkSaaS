import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { ProductsRoutePage } from "../features/products/products-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/products")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: ProductsRoutePage,
  errorComponent: AccountErrorPage,
});
