import { getTranslations } from "next-intl/server";
import { StudentsPreview } from "../../../components/admin/students-preview";

export async function generateMetadata() {
  return {
    title: (await getTranslations("students"))("demoTitle"),
    robots: { index: false, follow: false },
  };
}
export default function StudentsDesignPage() {
  return <StudentsPreview />;
}
