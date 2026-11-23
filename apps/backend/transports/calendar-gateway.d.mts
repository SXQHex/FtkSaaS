// Public contract of calendar-gateway.mjs for the personal-calendar Edge entry.
export declare function calendarProxy(options: {
  supabaseUrl: string | undefined;
  anonKey: string | undefined;
  fetcher?: typeof fetch;
  pathPrefix?: string;
  diagnostics?: boolean;
}): (request: Request) => Promise<Response>;
