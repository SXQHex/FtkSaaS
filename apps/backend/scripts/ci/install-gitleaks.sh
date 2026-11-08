#!/usr/bin/env bash
set -euo pipefail
# Pinned release and GitHub release-asset SHA256, reviewed together.
version=8.30.1
digest=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
destination="${1:?destination required}"
mkdir -p "$destination"
# Both addresses are owned by the publisher; no third-party executable mirror.
archive="$destination/gitleaks.tar.gz"
downloaded=false
for url in \
  https://api.github.com/repos/gitleaks/gitleaks/releases/assets/378332058 \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz"; do
  if curl --fail --silent --show-error --location --connect-timeout 15 --max-time 60 \
    --header 'Accept: application/octet-stream' "$url" -o "$archive"; then
    downloaded=true
    break
  fi
  rm -f "$archive"
  printf 'Download failed: %s; trying next official address\n' "$url" >&2
done
if [[ "$downloaded" != true ]]; then
  printf 'All official gitleaks download addresses failed\n' >&2
  exit 1
fi
printf '%s  %s\n' "$digest" "$destination/gitleaks.tar.gz" | sha256sum --check --status
tar --no-same-owner -xzf "$destination/gitleaks.tar.gz" -C "$destination" gitleaks
rm "$destination/gitleaks.tar.gz"
