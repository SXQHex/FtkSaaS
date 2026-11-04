import { getTranslations } from "next-intl/server";
import { DocumentsPreview } from "../../../components/admin/documents-preview";
export async function generateMetadata() {
  return {
    title: (await getTranslations("documents"))("demoTitle"),
    robots: { index: false, follow: false },
  };
}
export default function DocumentsDesignPage() {
  return <DocumentsPreview />;
}
