"use client";
import { Button } from "@ftksaas/ui/components/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="mx-auto max-w-lg space-y-5 px-6 py-24">
      <h1 className="text-2xl font-semibold">Çalışma alanı açılamadı</h1>
      <p>Bağlantını kontrol edip yeniden dene. Sorun sürerse destekle iletişime geç.</p>
      <Button onClick={reset}>Yeniden dene</Button>
    </main>
  );
}
