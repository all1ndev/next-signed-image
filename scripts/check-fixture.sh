#!/usr/bin/env bash
# Builds the fixture app against the built package with Turbopack and webpack, and checks that
# the signer never reaches the browser. Two negative controls prove the checks can fail.
set -euo pipefail

cd apps/fixture

# The signer, its guard, the unconfigured-signer error, the HMAC code and the fake secret.
LEAKS='bundled for the browser|no image signer is configured|createHmac|FIXTURE_SIGNER_MARKER|FAKE_SIGNING_SECRET|sekrit-value'

# Quiet: the unaliased control is expected to fail. Callers print build.log when it matters.
build() {
	rm -rf .next
	pnpm exec next build "$@" >build.log 2>&1
}

for bundler in --turbopack --webpack; do
	build "$bundler" || { cat build.log >&2; exit 1; }

	if grep -rlE "$LEAKS" .next/static; then
		echo "$bundler: the signer leaked into the browser bundle" >&2
		exit 1
	fi
	grep -rlq data-image-delivery .next/static || { echo "$bundler: no client Image in a browser chunk" >&2; exit 1; }

	html=.next/server/app/index.html
	for kind in as-is route signed; do
		grep -q "data-image-delivery=\"$kind\"" "$html" || { echo "$bundler: no $kind image rendered" >&2; exit 1; }
	done
	grep -q '<link rel="preload" as="image"' "$html" || { echo "$bundler: no preload hint" >&2; exit 1; }
	echo "$bundler: OK"
done

# Without withSignedImages, the build must fail with the setup error.
if FIXTURE_CONTROL=unaliased build; then
	echo "control unaliased: the build should have failed" >&2
	exit 1
fi
grep -q "no image signer is configured" build.log || { echo "control unaliased: wrong error" >&2; exit 1; }
echo "control unaliased: OK"

# Without the browser branch of the alias, the leak check must find the signer.
FIXTURE_CONTROL=leak build || { cat build.log >&2; exit 1; }
grep -rlqE "$LEAKS" .next/static || { echo "control leak: the leak check found nothing" >&2; exit 1; }
echo "control leak: OK"

rm -rf .next build.log
