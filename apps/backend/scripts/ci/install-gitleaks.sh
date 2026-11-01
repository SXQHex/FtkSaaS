#!/usr/bin/env bash
set -euo pipefail
# Pinned release and GitHub release-asset SHA256, reviewed together.
version=8.30.1
digest=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
destination="${1:?destination required}"
mkdir -p "$destination"
curl --fail --silent --show-error --location --max-time 120 \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz" \
  -o "$destination/gitleaks.tar.gz"
printf '%s  %s\n' "$digest" "$destination/gitleaks.tar.gz" | sha256sum --check --status
tar --no-same-owner -xzf "$destination/gitleaks.tar.gz" -C "$destination" gitleaks
rm "$destination/gitleaks.tar.gz"
