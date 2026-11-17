import { useTranslation } from "react-i18next";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../../components/ui/empty";

export function PublicUnavailableView() {
  const { t } = useTranslation();
  return (
    <Empty className="py-12">
      <EmptyHeader>
        <EmptyTitle>
          <h1>{t(($) => $.publicProgram.unavailable)}</h1>
        </EmptyTitle>
        <EmptyDescription>{t(($) => $.publicProgram.unavailableHint)}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
