#!/usr/bin/env bash
set -euo pipefail

# Official release assets and GitHub-published SHA256 digests are reviewed together.
install_tool() {
  local name="$1" url="$2" digest="$3"
  local archive="$destination/$name.tar.gz" metadata="$destination/$name-release.json"
  local repository tag asset alternative
  if ! curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 5 --max-time 20 "$url" -o "$archive"; then
    # A separate official API route avoids repeating a stalled release URL.
    # Four worst-case downloads fit inside the existing five-minute install step.
    [[ "$url" =~ ^https://github\.com/([^/]+/[^/]+)/releases/download/([^/]+)/([^/]+)$ ]] || return 1
    repository="${BASH_REMATCH[1]}" tag="${BASH_REMATCH[2]}" asset="${BASH_REMATCH[3]}"
    local auth=()
    if [[ -n "${GH_TOKEN:-}" ]]; then auth=(--header "Authorization: Bearer $GH_TOKEN"); fi
    printf 'Primary download failed for %s; trying official GitHub API alternative.\n' "$name"
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
      --connect-timeout 5 --max-time 10 --header 'Accept: application/vnd.github+json' \
      "${auth[@]}" "https://api.github.com/repos/$repository/releases/tags/$tag" -o "$metadata"
    alternative="$(node --input-type=module - "$metadata" "$repository" "$asset" <<'NODE'
import { readFileSync } from 'node:fs';
const [file, repository, name] = process.argv.slice(2);
const release = JSON.parse(readFileSync(file, 'utf8'));
const matches = release.assets?.filter(asset => asset.name === name);
if (matches?.length !== 1) throw Error('Pinned release asset not found');
const url = matches[0].url;
const prefix = `https://api.github.com/repos/${repository}/releases/assets/`;
if (typeof url !== 'string' || !url.startsWith(prefix) || !/^[1-9]\d*$/.test(url.slice(prefix.length)))
  throw Error('Untrusted release asset URL');
process.stdout.write(url);
NODE
)"
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
      --connect-timeout 5 --max-time 30 --header 'Accept: application/octet-stream' \
      "${auth[@]}" "$alternative" -o "$archive"
    rm "$metadata"
  fi
  # Integrity failure is terminal: never accept another source after a mismatch.
  printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status
  tar --no-same-owner -xzf "$archive" -C "$destination" "$name"
  rm "$archive"
  printf 'Installed %s from %s\n' "$name" "$url"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
destination="${1:?destination required}"
mkdir -p "$destination"
install_tool actionlint \
  https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz \
  8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
install_tool zizmor \
  https://github.com/zizmorcore/zizmor/releases/download/v1.31.1/zizmor-x86_64-unknown-linux-gnu.tar.gz \
  d185f726bdaf92df78273217dfdd24ebcd6b0ef48cf3ce776ff5762b6e138c99
install_tool poutine \
  https://github.com/boostsecurityio/poutine/releases/download/v1.1.6/poutine_Linux_x86_64.tar.gz \
  abde716599a65608b023a69ed9316e5f083a7bca48612151c2720835883757ea
install_tool pinact \
  https://github.com/suzuki-shunsuke/pinact/releases/download/v5.0.2/pinact_linux_amd64.tar.gz \
  7f003d8f51e984c2264d2009d430e3e0e87ae404a0e2dc2a9a277b0f731bf5b7
fi
