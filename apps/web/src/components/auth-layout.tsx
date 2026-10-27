import Link from "next/link";
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col justify-between bg-primary p-6 text-primary-foreground lg:p-14">
        <Link href="/giris" className="w-fit text-xl font-extrabold tracking-tight">
          FtkSaaS
        </Link>
        <div className="max-w-lg py-6 lg:py-24">
          <p className="mb-5 text-sm">Stüdyonun çalışma alanı</p>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight lg:text-5xl">
            Birlikte çalışmak için
            <br className="hidden lg:block" /> ortak bir alan.
          </h1>
          <p className="mt-6 max-w-sm leading-relaxed opacity-90">
            Hesabına giriş yap, kuruluşunu seç ve çalışma alanına geç.
          </p>
        </div>
        <p className="hidden text-sm opacity-90 lg:block">Stüdyo yönetimi, aynı ritimde.</p>
      </section>
      <section
        aria-label="Hesap erişimi"
        className="flex items-center justify-center px-6 py-12 lg:p-16"
      >
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
