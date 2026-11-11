import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

import { defaultImageSizes, type ImageSizes } from "./sizes.ts";

export { defaultImageSizes, type ImageSizes } from "./sizes.ts";

const SIGNER = "@all1ndev/next-signed-image/signer";
const BROWSER_SIGNER = "@all1ndev/next-signed-image/signer/browser";

export type SignedImagesOptions = {
	/** The app's signer module, relative to the project root. It exports `imageSigner`. */
	signer: string;
	/** Pass the same object to `createImageRoute`: a width the route rejects breaks every image. */
	sizes?: ImageSizes;
};

/**
 * Points the package's signer specifier at the app's signer on the server and at a stub in the
 * browser, and makes every image go through a loader (no `/_next/image`).
 */
export function withSignedImages(
	nextConfig: NextConfig,
	{ signer, sizes = defaultImageSizes }: SignedImagesOptions,
): NextConfig {
	const { loaderFile: _loaderFile, ...images } = nextConfig.images ?? {};
	const browserStub = fileURLToPath(new URL("./signer.browser.js", import.meta.url));

	return {
		...nextConfig,
		images: { ...images, loader: "custom", ...sizes },
		turbopack: {
			...nextConfig.turbopack,
			resolveAlias: {
				...nextConfig.turbopack?.resolveAlias,
				// `browser` is the only condition Turbopack's resolveAlias supports.
				[SIGNER]: { browser: BROWSER_SIGNER, default: signer },
			},
		},
		webpack(config, context) {
			const result = nextConfig.webpack ? nextConfig.webpack(config, context) : config;

			result.resolve.alias = {
				...result.resolve.alias,
				[`${SIGNER}$`]: context.isServer ? path.resolve(context.dir, signer) : browserStub,
			};

			return result;
		},
	};
}
