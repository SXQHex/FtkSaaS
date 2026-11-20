import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CopyIcon, SearchIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@ftksaas/ui/components/card";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@ftksaas/ui/components/accordion";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@ftksaas/ui/components/input-group";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemActions } from "@ftksaas/ui/components/item";
import { Kbd } from "@ftksaas/ui/components/kbd";
import { Button } from "@ftksaas/ui/components/button";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
export interface HelpGroup {
  id: string;
  title: string;
  questions: { id: string; question: string; answer: string }[];
}
export interface HelpSupport {
  email: string;
  response: string;
  hours: string;
}
export function HelpView({
  groups,
  query,
  onQuery,
  support,
  onCopy,
  feedback,
  onStates,
}: {
  groups: HelpGroup[];
  query: string;
  onQuery: (value: string) => void;
  support: HelpSupport;
  onCopy: () => void;
  feedback: string;
  onStates?: () => void;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.help.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.help.description)}</p>
        </div>
        {onStates && (
          <Button variant="outline" onPress={onStates}>
            {t(($) => $.help.states)}
          </Button>
        )}
      </header>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <InputGroup className="w-full max-w-[26rem]">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label={t(($) => $.help.searchLabel)}
              placeholder={t(($) => $.help.searchPlaceholder)}
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              autoComplete="off"
            />
          </InputGroup>
          {groups.length === 0 ? (
            <Empty>
              <EmptyDescription>{t(($) => $.help.empty)}</EmptyDescription>
            </Empty>
          ) : (
            groups.map((group) => (
              <Card
                key={group.id}
                className="min-w-0"
                role="group"
                aria-labelledby={`${id}-${group.id}`}
              >
                <CardHeader>
                  <CardTitle>
                    <h2 id={`${id}-${group.id}`}>{group.title}</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion
                    key={`${group.id}:${query}`}
                    allowsMultipleExpanded
                    defaultExpandedKeys={query.trim() ? group.questions.map((row) => row.id) : []}
                  >
                    {group.questions.map((row) => (
                      <AccordionItem key={row.id} id={row.id}>
                        <AccordionTrigger>{row.question}</AccordionTrigger>
                        <AccordionContent>
                          <p className="whitespace-pre-line wrap-anywhere">{row.answer}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <aside
          className="flex min-w-0 flex-col gap-4"
          aria-label={t(($) => $.help.supportAndShortcuts)}
        >
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.help.support)}</h2>
              </CardTitle>
              <CardDescription>{t(($) => $.help.supportDescription)}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
                <dt className="text-muted-foreground">{t(($) => $.help.email)}</dt>
                <dd className="min-w-0 select-text wrap-anywhere">{support.email}</dd>
                <dt className="text-muted-foreground">{t(($) => $.help.response)}</dt>
                <dd className="min-w-0 wrap-anywhere">{support.response}</dd>
                <dt className="text-muted-foreground">{t(($) => $.help.hours)}</dt>
                <dd className="min-w-0 whitespace-pre-line tabular-nums wrap-anywhere">
                  {support.hours}
                </dd>
              </dl>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center gap-3 border-t">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {t(($) => $.help.copyHelp)}
              </p>
              <Button variant="outline" size="sm" onPress={onCopy}>
                <CopyIcon data-icon="inline-start" />
                {t(($) => $.help.copy)}
              </Button>
              <p role="status" aria-atomic="true" className="w-full text-xs wrap-anywhere">
                {feedback}
              </p>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.help.shortcuts)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {(
                  [
                    ["search", "Ctrl / ⌘ K"],
                    ["close", "Esc"],
                    ["select", "Enter"],
                    ["next", "Tab"],
                  ] as const
                ).map(([key, keys]) => (
                  <Item role="listitem" key={key} className="flex-wrap px-0">
                    <ItemContent>
                      <ItemTitle>{t(($) => $.help.shortcutLabels[key])}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Kbd>{keys}</Kbd>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
