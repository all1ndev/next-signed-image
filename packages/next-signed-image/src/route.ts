import { type ImageSigner, type ImageSizes, defaultImageSizes } from "./delivery.js";

export type { ImageSigner, ImageSizes } from "./delivery.js";

/**
 * Marks the app's signer. Stands in for `server-only`, which the SSR pass of a client
 * component cannot import: it throws if the signer module is ever evaluated in a browser.
 */
export function defineImageSigner<Signer extends ImageSigner>(signer: Signer): Signer {
	if (typeof window !== "undefined") {
		throw new Error(
			"@all1ndev/next-signed-image: the image signer was bundled for the browser. Is next.config wrapped with withSignedImages?",
		);
	}

	return signer;
}

/**
 * The App Router GET handler behind /api/image, for images that first render in the browser:
 * 400 for a width or quality next/image would not request, 403 for a source the signer
 * refuses, else a 302 to the signed URL or to the file itself.
 */
export function createImageRoute(
	signer: ImageSigner,
	{ sizes = defaultImageSizes }: { sizes?: ImageSizes } = {},
): (request: Request) => Response {
	const widths = new Set([...sizes.deviceSizes, ...sizes.imageSizes]);
	const qualities = new Set(sizes.qualities);

	// Signing exists so outsiders cannot make the resizer render arbitrary sizes or sources.
	return function GET(request) {
		const params = new URL(request.url).searchParams;
		const src = params.get("src");
		const width = Number(params.get("w"));
		const quality = Number(params.get("q"));

		if (!src || !widths.has(width) || !qualities.has(quality)) {
			return new Response("Bad request", { status: 400 });
		}

		const kind = signer.delivery(src);

		if (kind === "sign") return redirect(signer.sign({ src, width, quality }));

		// The target is request input: redirect only to its normalized http(s) form.
		const asIs = kind === "as-is" ? parseHttpUrl(src) : null;

		if (asIs) return redirect(asIs.href);

		return new Response("Forbidden", { status: 403 });
	};
}

// 302, not 308: a permanent redirect is cached for good and would outlive a key rotation.
function redirect(location: string): Response {
	return new Response(null, {
		status: 302,
		headers: { Location: location, "Cache-Control": "public, max-age=86400" },
	});
}

function parseHttpUrl(src: string): URL | null {
	try {
		const url = new URL(src);
		return url.protocol === "https:" || url.protocol === "http:" ? url : null;
	} catch {
		return null;
	}
}
