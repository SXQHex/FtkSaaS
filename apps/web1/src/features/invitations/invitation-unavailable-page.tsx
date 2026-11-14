import { useTranslation } from "react-i18next";
import { AuthLayout } from "../auth/auth-layout";
import { LinkButton } from "../../components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../components/ui/empty";

export function InvitationUnavailablePage() {
  const { t } = useTranslation();
  return (
    <AuthLayout>
      <Empty className="items-start p-0 text-left">
        <EmptyHeader className="items-start gap-1">
          <EmptyTitle>
            <h1>{t(($) => $.invitation.unavailableTitle)}</h1>
          </EmptyTitle>
          <EmptyDescription>{t(($) => $.invitation.unavailableDescription)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row flex-wrap justify-start gap-2">
          <LinkButton href="/invite">{t(($) => $.invitation.checkAccount)}</LinkButton>
          <LinkButton href="/login" variant="outline">
            {t(($) => $.auth.backLogin)}
          </LinkButton>
        </EmptyContent>
      </Empty>
    </AuthLayout>
  );
}
