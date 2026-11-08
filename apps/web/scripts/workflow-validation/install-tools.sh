#!/usr/bin/env bash
set -euo pipefail

# Official release assets and GitHub-published SHA256 digests are reviewed together.
destination="${1:?destination required}"
mkdir -p "$destination"
install_tool() {
  local name="$1" url="$2" digest="$3" mirror="$4"
  local downloaded=false source
  local archive="$destination/$name.tar.gz"
  # Both addresses are owned by the publisher; SHA256 is mandatory on either.
  for source in "$mirror" "$url"; do
    if curl --fail --silent --show-error --location --connect-timeout 15 --max-time 60 \
      --header 'Accept: application/octet-stream' "$source" -o "$archive"; then
      downloaded=true
      break
    fi
    rm -f "$archive"
    printf 'Download failed: %s; trying next official address\n' "$source" >&2
  done
  if [[ "$downloaded" != true ]]; then
    printf 'All official %s download addresses failed\n' "$name" >&2
    return 1
  fi
  printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status
  tar --no-same-owner -xzf "$archive" -C "$destination" "$name"
  rm "$archive"
  printf 'Installed %s from %s\n' "$name" "$source"
}

install_tool actionlint \
  https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz \
  8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 \
  https://api.github.com/repos/rhysd/actionlint/releases/assets/384924896
install_tool zizmor \
  https://github.com/zizmorcore/zizmor/releases/download/v1.31.1/zizmor-x86_64-unknown-linux-gnu.tar.gz \
  d185f726bdaf92df78273217dfdd24ebcd6b0ef48cf3ce776ff5762b6e138c99 \
  https://api.github.com/repos/zizmorcore/zizmor/releases/assets/645467284
install_tool poutine \
  https://github.com/boostsecurityio/poutine/releases/download/v1.1.6/poutine_Linux_x86_64.tar.gz \
  abde716599a65608b023a69ed9316e5f083a7bca48612151c2720835883757ea \
  https://api.github.com/repos/boostsecurityio/poutine/releases/assets/427347440
install_tool pinact \
  https://github.com/suzuki-shunsuke/pinact/releases/download/v5.0.2/pinact_linux_amd64.tar.gz \
  7f003d8f51e984c2264d2009d430e3e0e87ae404a0e2dc2a9a277b0f731bf5b7 \
  https://api.github.com/repos/suzuki-shunsuke/pinact/releases/assets/675205650
