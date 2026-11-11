import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { withSignedImages } from "@all1ndev/next-signed-image/config";
import type { NextConfig } from "next";

// pnpm's global virtual store keeps `next` outside the checkout, and
// Turbopack refuses to resolve past its root, so the root widens to the nearest common ancestor
// of both. Drop once https://github.com/vercel/next.js/issues/93556 is fixed.
const workspaceRoot = path.resolve(import.meta.dirname, "../..");
const nextRoot = fs.realpathSync(
	path.dirname(createRequire(import.meta.url).resolve("next/package.json")),
);

function commonAncestor(a: string, b: string): string {
	const aParts = a.split(path.sep);
	const bParts = b.split(path.sep);
	let index = 0;
	while (index < aParts.length && aParts[index] === bParts[index]) index++;
	return aParts.slice(0, index).join(path.sep) || path.sep;
}

const base: NextConfig = { turbopack: { root: commonAncestor(workspaceRoot, nextRoot) } };
const config = withSignedImages(base, { signer: "./src/image-signer.ts" });

// Negative controls for the proofs in the README; never set them in an app.
const control = process.env["FIXTURE_CONTROL"];
const leakAlias = { "@all1ndev/next-signed-image/signer": "./src/image-signer.ts" };

export default control === "unaliased"
	? { ...base, images: config.images }
	: control === "leak"
		? { ...config, turbopack: { ...config.turbopack, resolveAlias: leakAlias } }
		: config;
