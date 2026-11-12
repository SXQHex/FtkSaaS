import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const [count, setCount] = useState(0);
  const { t } = useTranslation("common");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">{t(($) => $.app.title)}</h1>

      <p className="text-muted-foreground">{t(($) => $.app.description)}</p>

      <Button onPress={() => setCount((value) => value + 1)}>{t(($) => $.demo.action)}</Button>

      <p role="status">{t(($) => $.demo.clickCount, { value: count })}</p>
    </main>
  );
}
