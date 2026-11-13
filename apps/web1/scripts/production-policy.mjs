import { createHash } from "node:crypto";

// User-approved official no-op only. Updates require source review and new hashes.
// https://tanstack.com/devtools/latest/docs/production#event-client-in-production
const hashes = {
  "noop.js": "9b1c0e338ac0028133748e41f93ae8ce01e88d399e34458ef58228175f4527d1",
  "index.js": "30f1fba82f43896828c9781a51427a04b1b9568994be920335b963e34f957add",
};
export function verifiedNoop(file, version, bytes) {
  return (
    version === "0.5.1" &&
    Object.hasOwn(hashes, file) &&
    createHash("sha256").update(bytes).digest("hex") === hashes[file]
  );
}
