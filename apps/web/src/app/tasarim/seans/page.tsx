import { getTranslations } from "next-intl/server";
import { SessionChangePreview } from "../../../components/admin/session-change-preview";

export async function generateMetadata() {
  return {
    title: (await getTranslations("sessionChange"))("demoTitle"),
    robots: { index: false, follow: false },
  };
}
export default function SessionDesignPage() {
  return <SessionChangePreview />;
}
