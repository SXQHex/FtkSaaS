import { useState } from "react";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const [count, setCount] = useState(0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">FtkSaaS V2</h1>

      <p className="text-muted-foreground">Vite + React + TanStack Router + React Aria</p>

      <Button onPress={() => setCount((value) => value + 1)}>Test Et</Button>

      <p role="status">Tıklama sayısı: {count}</p>
    </main>
  );
}
