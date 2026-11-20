import "@testing-library/jest-dom/vitest";
import { HttpResponse } from "msw";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

beforeAll(() => {
  server.listen({
    // MSW's string strategy ignores common assets; tests must block those as well.
    onUnhandledFrame({ defaults }) {
      defaults.error();
      throw HttpResponse.error();
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});
