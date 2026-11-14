import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, AccountErrorPage } from "../features/auth/account-page";
import { requireAccountSession, loadAccount } from "../features/auth/account-guard";

export const Route = createFileRoute("/account")({
  beforeLoad: requireAccountSession,
  loader: loadAccount,
  component: AccountPage,
  errorComponent: AccountErrorPage,
});
