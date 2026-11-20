import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { DocumentsRoutePage } from "../features/documents/documents-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/documents")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: DocumentsRoutePage,
  errorComponent: AccountErrorPage,
});
