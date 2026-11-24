#!/usr/bin/env bash
set -euo pipefail

output=${1:?Runtime package output directory required}
mkdir -p "$output"
output=$(realpath "$output")
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

acceptance=$(cd -- "$(dirname -- "$0")/../acceptance" && pwd)
revision=0dd15ef2281b60ea03413ef5d2a60ebb25b0e21d
patch_digest=f9eaafb77992facc4be62af4b265c38bd5564b45fdf6e42539e67975afe5c92c
probe_digest=222b2ef800a3f491b9da1077cd970f865b5f74c39f99848b390351ffcd856e8a
official_tag=edge-runtime-v1.77.9-r0
test "$(uname -s)-$(uname -m)" = Linux-x86_64
printf '%s  %s\n' "$patch_digest" "$acceptance/xreq-072-edge-runtime.patch" \
  "$probe_digest" "$acceptance/edge-response-lifecycle.mjs" | sha256sum --check

fetch() {
  curl --proto '=https' --proto-redir '=https' --fail --silent --show-error --location --retry 2 "$1" --output "$2"
}

official_archive="$official_tag-linux-amd64.tar.zst"
fetch "https://github.com/supabase/slim-services/releases/download/$official_tag/$official_archive" "$scratch/official.tar.zst" ||
  fetch "https://supabase-cli-artifacts.s3.us-east-1.amazonaws.com/edge-runtime/v1.77.9-r0/$official_archive" "$scratch/official.tar.zst"
printf 'd61748740756c192d83b2d5e6960bc20e2eb748fd7aee7620bfd4bf5854013b6  %s\n' "$scratch/official.tar.zst" | sha256sum --check
mkdir "$scratch/package"
tar --extract --zstd --file "$scratch/official.tar.zst" --directory "$scratch/package"

fetch https://github.com/supabase/rusty_v8/releases/download/v130.0.7/librusty_v8_release_x86_64-unknown-linux-gnu.a.gz "$scratch/v8.a.gz"
gzip --decompress --stdout "$scratch/v8.a.gz" > "$scratch/v8.a"
printf 'b292248382187abb845a037d1e0b301303dcaa108f9e0582288067ef591feebc  %s\n' "$scratch/v8.a" | sha256sum --check

git init --quiet "$scratch/source"
git -C "$scratch/source" fetch --quiet --depth=1 https://github.com/supabase/edge-runtime.git "$revision"
git -C "$scratch/source" checkout --quiet --detach FETCH_HEAD
test "$(git -C "$scratch/source" rev-parse HEAD)" = "$revision"
git -C "$scratch/source" apply "$acceptance/xreq-072-edge-runtime.patch"
(
  cd "$scratch/source"
  export RUSTY_V8_ARCHIVE="$scratch/v8.a"
  export CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_PROFILE_RELEASE_LTO=off CARGO_PROFILE_RELEASE_STRIP=symbols
  cargo +1.98.0 build --locked --release --bin edge-runtime
)
binary="$scratch/package/bin/.edge-runtime-wrapped"
install -m 0755 "$scratch/source/target/release/edge-runtime" "$binary"
binary_digest=$(sha256sum < "$binary" | cut -d ' ' -f 1)
node "$acceptance/edge-response-lifecycle.mjs" "$binary" "$binary_digest" "$scratch/package/lib"

archive="$output/$official_tag-linux-amd64.tar.zst"
manifest="$output/$official_tag-linux-amd64.manifest.json"
tar --create --zstd --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
  --file "$archive" --directory "$scratch/package" .
printf '%s\n' '{"service":"edge-runtime","version":"v1.77.9-r0","target":"linux-amd64"}' > "$manifest"
archive_digest=$(sha256sum < "$archive" | cut -d ' ' -f 1)
manifest_digest=$(sha256sum < "$manifest" | cut -d ' ' -f 1)
printf 'Upstream %s\nPatch %s\nELF %s\nArchive %s\nManifest %s\n' \
  "$revision" "$patch_digest" "$binary_digest" "$archive_digest" "$manifest_digest"
if [[ -n ${GITHUB_OUTPUT:-} ]]; then
  printf 'archive=%s\nmanifest=%s\nelf=%s\n' "$archive_digest" "$manifest_digest" "$binary_digest" >> "$GITHUB_OUTPUT"
fi
