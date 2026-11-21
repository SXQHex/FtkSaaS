import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AccountPage, AccountErrorPage } from "../features/auth/account-page";
import { requireAccountSession, loadAccountWithPlatformWorkspace } from "../features/auth/account-guard";

const search = z.object({ org: z.uuid().optional(), center: z.uuid().optional() });

export const Route = createFileRoute("/account")({
  beforeLoad: requireAccountSession,
  loaderDeps: ({ search: { org } }) => ({ org }),
  loader: loadAccountWithPlatformWorkspace,
  validateSearch: (input) => search.parse(input),
  remountDeps: ({ search: { org, center } }) => ({ org, center }),
  component: AccountPage,
  errorComponent: AccountErrorPage,
});
