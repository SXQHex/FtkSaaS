import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Set paths before loading Playwright: its browser registry reads the environment on import.
const root = fileURLToPath(new URL("../", import.meta.url));
const tmp = fileURLToPath(new URL("../.tmp/", import.meta.url));
mkdirSync(tmp, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url)),
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: fileURLToPath(new URL("../.npm-cache/", import.meta.url)),
      TMPDIR: tmp,
      TMP: tmp,
      TEMP: tmp,
      PLAYWRIGHT_BROWSERS_PATH: fileURLToPath(new URL("../.playwright-browsers/", import.meta.url)),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
