import { getTranslations } from "next-intl/server";
import { AdminPreview } from "../../components/admin/admin-preview";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("preview"), robots: { index: false, follow: false } };
}

export default function DesignPreviewPage() {
  return <AdminPreview />;
}
