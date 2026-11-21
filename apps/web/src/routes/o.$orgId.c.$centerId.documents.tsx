import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadScopedAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { DocumentsRoutePage } from "../features/documents/documents-page";
export const Route = createFileRoute("/o/$orgId/c/$centerId/documents")({
  beforeLoad: requireAccountSession,
  loader: ({ context, params }) => loadScopedAccount(context, params.orgId),
  component: DocumentsRoutePage,
  errorComponent: AccountErrorPage,
});
