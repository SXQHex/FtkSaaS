import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, PlayIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
export function InstructorSessionView({
  title,
  subtitle,
  badges,
  facts,
  timezone,
  attendance,
  startEditor,
  overlays,
  notice,
  onBack,
  onStart,
  locked = false,
}: {
  title: string;
  subtitle: string;
  badges: string[];
  facts: { label: string; value: string }[];
  timezone: string;
  attendance: ReactNode;
  startEditor?: ReactNode;
  overlays?: ReactNode;
  notice?: ReactNode;
  onBack: () => void;
  onStart?: () => void;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <div>
        <Button variant="link" className="px-0" isDisabled={locked} onPress={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t(($) => $.instructorSession.back)}
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {badges.map((text) => (
            <Badge key={text} variant="outline">
              {text}
            </Badge>
          ))}
        </div>
      </header>
      {notice}
      <Card className="min-w-0">
        <CardContent className="grid min-w-0 grid-cols-1 gap-4 pt-5 @sm:grid-cols-2 @3xl:grid-cols-4">
          {facts.map((row) => (
            <div key={row.label} className="min-w-0">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="mt-1 break-words font-medium">{row.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{timezone}</p>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.instructorSession.attendance)}</h2>
          </CardTitle>
          <CardDescription>{t(($) => $.instructorSession.explicitSave)}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {startEditor}
          {(onStart || startEditor) && (
            <Button isDisabled={locked || !onStart} onPress={onStart}>
              <PlayIcon data-icon="inline-start" />
              {t(($) => $.instructorSession.start)}
            </Button>
          )}
          {attendance}
        </CardContent>
      </Card>
      {overlays}
    </div>
  );
}
