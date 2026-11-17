import { createFileRoute } from "@tanstack/react-router";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";
import { AccountErrorPage } from "../features/auth/account-page";
import { HelpPage } from "../features/help/help-page";
export const Route = createFileRoute("/help")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: HelpPage,
  errorComponent: AccountErrorPage,
});
