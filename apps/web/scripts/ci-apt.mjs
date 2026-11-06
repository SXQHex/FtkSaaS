import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// GitHub's Ubuntu image uses a mirror list whose Azure endpoint can stall both
// index refresh and package downloads. Use the signed Ubuntu archive directly.
export function configureApt(root = "/etc/apt") {
  const sources = join(root, "sources.list.d");
  const files = [
    join(root, "sources.list"),
    ...(existsSync(sources)
      ? readdirSync(sources)
          .filter((name) => /\.(list|sources)$/.test(name))
          .map((name) => join(sources, name))
      : []),
  ];
  const ubuntu =
    /(?:mirror\+file:\/etc\/apt\/apt-mirrors\.txt|https?:\/\/(?:azure\.archive|archive|security)\.ubuntu\.com\/ubuntu\/?)(?=\s|$)/g;
  let found = false;
  for (const file of files) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    const direct = source.replace(ubuntu, () => {
      found = true;
      return "https://archive.ubuntu.com/ubuntu";
    });
    if (direct !== source) writeFileSync(file, direct);
  }
  if (!found) throw Error("UBUNTU_APT_SOURCE_NOT_FOUND");
  writeFileSync(
    join(root, "apt.conf.d/99-ftksaas-network"),
    [
      'Acquire::Retries "2";',
      'Acquire::http::Timeout "30";',
      'Acquire::https::Timeout "30";',
      'APT::Update::Error-Mode "any";',
      "",
    ].join("\n"),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  configureApt();
  console.log("Ubuntu APT: direct official HTTPS archive; 30-second network timeout; two retries.");
}
