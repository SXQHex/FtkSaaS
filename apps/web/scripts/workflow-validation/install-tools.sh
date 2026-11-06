#!/usr/bin/env bash
set -euo pipefail

# Official release assets and GitHub-published SHA256 digests are reviewed together.
destination="${1:?destination required}"
mkdir -p "$destination"
install_tool() {
  local name="$1" url="$2" digest="$3"
  local archive="$destination/$name.tar.gz"
  curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 120 \
    "$url" -o "$archive"
  printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status
  tar --no-same-owner -xzf "$archive" -C "$destination" "$name"
  rm "$archive"
  printf 'Installed %s from %s\n' "$name" "$url"
}

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
