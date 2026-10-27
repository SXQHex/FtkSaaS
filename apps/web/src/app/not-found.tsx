import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto max-w-lg space-y-5 px-6 py-24">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
      <Link className="text-primary underline" href="/">
        Çalışma alanına dön
      </Link>
    </main>
  );
}
