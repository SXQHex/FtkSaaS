import { createFileRoute } from "@tanstack/react-router";
import { InvitationUnavailablePage } from "../features/invitations/invitation-unavailable-page";

export const Route = createFileRoute("/invite_/expired")({ component: InvitationUnavailablePage });
