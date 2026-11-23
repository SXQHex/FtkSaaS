// Public contract of browser-cors.mjs for the Edge TypeScript importer.
export interface BrowserCorsResult {
  headers?: Readonly<Record<string, string>>;
  response?: Response;
}
export declare function browserCors(request: Request, env: { FTK_BROWSER_ORIGINS?: string }): BrowserCorsResult;
export declare function applyBrowserCors(response: Response, headers?: Readonly<Record<string, string>>): Response;
