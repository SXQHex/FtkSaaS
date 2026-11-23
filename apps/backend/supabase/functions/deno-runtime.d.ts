// Deno.serve and Deno.env are the only Deno globals used by these Edge entries.
// The handler callback uses Fetch API types; no ambient escape hatch is needed.
declare const Deno: {
  readonly env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
