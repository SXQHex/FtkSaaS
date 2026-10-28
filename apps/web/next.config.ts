import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const config: NextConfig = {
  transpilePackages: ["@ftksaas/ui", "@ftksaas/api-contracts"],
  devIndicators: false,
};
export default createNextIntlPlugin()(config);
