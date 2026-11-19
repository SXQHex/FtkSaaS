import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, AccountErrorPage } from "../features/auth/account-page";
import { requireAccountSession, loadPlatformAccount } from "../features/auth/account-guard";

export const Route = createFileRoute("/account")({
  beforeLoad: requireAccountSession,
  loader: loadPlatformAccount,
  component: AccountPage,
  errorComponent: AccountErrorPage,
});
