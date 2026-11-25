#!/usr/bin/env bash
set -euo pipefail

destination="${1:?Corepack installation directory required}"
bin="$destination/bin"
mkdir -p "$bin"

if [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 25 ]]; then
  bundled_corepack="$(dirname "$(command -v node)")/corepack"
  test -x "$bundled_corepack"
  ln -sfn "$bundled_corepack" "$bin/corepack"
else
  # Release digest published by nodejs/corepack v0.36.0, also matching npm.
  url=https://registry.npmjs.org/corepack/-/corepack-0.36.0.tgz
  sha256=9128cfe26aee0c99f4fc68c15c6b8b12309a68be0de2c012cdfea2a463cb722f
  archive="$destination/corepack.tgz"
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 5 --max-time 30 "$url" -o "$archive"
  node --input-type=module - "$archive" "$sha256" <<'NODE'
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const [archive, expected] = process.argv.slice(2);
const actual = createHash('sha256').update(readFileSync(archive)).digest('hex');
if (actual !== expected) throw Error('Corepack archive SHA256 mismatch');
NODE
  tar --no-same-owner -xzf "$archive" -C "$destination"
  rm "$archive"
  ln -sfn ../package/dist/corepack.js "$bin/corepack"
fi

printf '%s\n' "$bin"
