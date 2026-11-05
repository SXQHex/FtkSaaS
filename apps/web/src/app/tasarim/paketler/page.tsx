import { getTranslations } from "next-intl/server";
import { ProductsPreview } from "../../../components/admin/products-preview";
export async function generateMetadata() {
  return {
    title: (await getTranslations("products"))("demoTitle"),
    robots: { index: false, follow: false },
  };
}
export default function ProductDesignPage() {
  return <ProductsPreview />;
}
