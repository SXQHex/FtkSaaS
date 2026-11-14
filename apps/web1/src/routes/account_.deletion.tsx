import { createFileRoute } from "@tanstack/react-router";
import { deletionContext } from "../features/account/deletion";
import { DeletionPage } from "../features/account/deletion-page";
export const Route = createFileRoute("/account_/deletion")({
  loader: deletionContext,
  component: DeletionPage,
});
