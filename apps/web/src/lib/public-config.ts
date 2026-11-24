function readText(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function readHttpUrl(value: unknown) {
  const text = readText(value);
  if (!text) return;
  try {
    const url = new URL(text);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return;
    return url;
  } catch {
    return;
  }
}

const supabaseConfigError = "Supabase bağlantı yapılandırması eksik.";

export function requireSupabaseUrl() {
  const url = readHttpUrl(import.meta.env.VITE_SUPABASE_URL);
  if (!url) throw new Error(supabaseConfigError);
  return url.href.replace(/\/$/, "");
}

export function requireSupabasePublishableKey() {
  const key = readText(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!key) throw new Error(supabaseConfigError);
  return key;
}

export function hasSupabaseConfig() {
  return Boolean(
    readHttpUrl(import.meta.env.VITE_SUPABASE_URL) &&
    readText(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  );
}

export function readPublicGatewayUrl() {
  return readHttpUrl(import.meta.env.VITE_PUBLIC_GATEWAY_URL)?.href.replace(/\/$/, "");
}

export function requireAppOrigin() {
  const app = readHttpUrl(import.meta.env.VITE_APP_ORIGIN);
  if (!app || app.pathname !== "/") throw new Error("APP_ORIGIN_REQUIRED");
  return app.origin;
}

export function readTurnstileSiteKey() {
  return readText(import.meta.env.VITE_TURNSTILE_SITE_KEY);
}
