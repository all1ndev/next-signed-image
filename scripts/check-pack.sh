#!/usr/bin/env bash
# Packs the package as `pnpm publish` would and checks what ships: only dist, README, LICENSE
# and package.json, every conditional entry point present, and no unresolved `catalog:`.
set -euo pipefail

out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

cd packages/next-signed-image
pnpm pack --pack-destination "$out" >/dev/null
tarball=$(ls "$out"/*.tgz)
files=$(tar -tzf "$tarball" | sed 's|^package/||' | sort)

unexpected=$(grep -vE '^(dist/.+|README\.md|LICENSE|package\.json)$' <<<"$files" || true)
if [[ -n "$unexpected" ]]; then
	echo "Unexpected files in the tarball:" >&2
	echo "$unexpected" >&2
	exit 1
fi

for entry in image.client image.server signer.browser signer.default route config delivery; do
	for ext in js d.ts; do
		grep -qx "dist/$entry.$ext" <<<"$files" || { echo "Missing dist/$entry.$ext" >&2; exit 1; }
	done
done

if tar -xzOf "$tarball" package/package.json | grep -q '"catalog:'; then
	echo "The packed package.json still has catalog: specifiers" >&2
	exit 1
fi

echo "Tarball OK: $(wc -l <<<"$files" | tr -d ' ') files"
