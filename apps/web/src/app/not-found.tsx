import { getTranslations } from "next-intl/server";
import Link from "next/link";
export default async function NotFound() {
  const t = await getTranslations("pages");
  return (
    <main id="main-content" className="mx-auto max-w-lg space-y-5 px-6 py-24">
      <h1 className="text-2xl font-semibold">{t("notFound")}</h1>
      <Link className="text-primary underline" href="/">
        {t("return")}
      </Link>
    </main>
  );
}
