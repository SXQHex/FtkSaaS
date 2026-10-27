import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@ftksaas/ui", "@ftksaas/api-contracts"],
  devIndicators: false,
};
export default config;
