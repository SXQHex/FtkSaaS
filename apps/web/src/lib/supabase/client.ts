"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "../config";
export function browserClient() {
  const config = publicConfig();
  if (!config) throw new Error("Giriş bağlantısı yapılandırılmadı.");
  return createBrowserClient(config.url, config.publishableKey);
}
