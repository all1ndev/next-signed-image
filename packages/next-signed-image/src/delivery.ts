import {
	getImageProps,
	type ImageLoader,
	type ImageLoaderProps,
	type ImageProps as NextImageProps,
} from "next/image";

import { DEFAULT_QUALITY } from "./sizes.js";

export { DEFAULT_QUALITY, defaultImageSizes, type ImageSizes } from "./sizes.js";

/**
 * The app's signing policy and key, provider-agnostic. Lives in the app's own module (the one
 * named by `withSignedImages({ signer })`), exported as `imageSigner`.
 */
export type ImageSigner = {
	/**
	 * How a remote `src` is served: `"as-is"` by its own URL (a file that gains nothing from a
	 * resize), `"sign"` through signed URLs, `"route"` refused (the route answers 403).
	 * Same-origin paths and SVGs never reach it: they are always served as-is.
	 */
	delivery(src: string): "as-is" | "sign" | "route";
	/** A signed URL for `src` resized to `width`. Only called after `delivery` returned "sign". */
	sign(image: { src: string; width: number; quality: number }): string;
};

export type ImageProps = Omit<NextImageProps, "loader" | "unoptimized">;

/** The URL a `src` points at: a static import's file, or the string itself. */
export function srcUrl(src: ImageProps["src"]): string {
	if (typeof src === "string") return src;

	return "default" in src ? src.default.src : src.src;
}

/** Signed URLs by width. */
export type SignedWidths = Readonly<Record<number, string>>;

/**
 * How an image is served: by its own URL, through the /api/image redirect, or from URLs signed
 * on the server. `kind` is also the `data-image-delivery` value hydration reads.
 */
export type Delivery =
	| { readonly kind: "as-is" }
	| { readonly kind: "route" }
	| { readonly kind: "signed"; readonly widths: SignedWidths };

export const AS_IS: Delivery = { kind: "as-is" };
export const ROUTE: Delivery = { kind: "route" };

export const IMAGE_ROUTE = "/api/image";
const SAME_ORIGIN_PROBE = "https://same-origin.invalid";

/**
 * Served by URL, never signed, and decidable without the signer so the browser agrees:
 * same-origin assets (/public, static imports) have no origin a resizer could fetch from, and
 * SVGs are vectors with nothing to resize.
 */
export function isServedAsIs(src: string): boolean {
	return isSameOriginPath(src) || isSvg(src);
}

/** What a render with no server behind it can decide: no key, no signing policy. */
export function browserDelivery(src: string): Delivery {
	return isServedAsIs(src) ? AS_IS : ROUTE;
}

/**
 * How an `Image` rendered on the server is served. A signed source is signed for exactly the
 * widths next/image requests with these props. `undefined` without a signer (the browser).
 */
export function serverDelivery(
	props: Readonly<ImageProps>,
	signer: ImageSigner | undefined,
): Delivery | undefined {
	if (!signer) return undefined;

	const src = srcUrl(props.src);

	if (isServedAsIs(src)) return AS_IS;

	const kind = signer.delivery(src);

	if (kind === "as-is") return AS_IS;
	if (kind !== "sign") return ROUTE;

	const widths: Record<number, string> = {};

	getImageProps({
		...props,
		loader: ({ src, width, quality = DEFAULT_QUALITY }) =>
			(widths[width] = signer.sign({ src, width, quality })),
	});

	return { kind: "signed", widths };
}

// Every path names a loader: with `images.loader: "custom"` and no loaderFile, Next throws
// "missing loader" before it reads `unoptimized`.
export function nextImageDelivery(delivery: Delivery): {
	loader: ImageLoader;
	unoptimized?: true;
} {
	if (delivery.kind === "as-is") return { unoptimized: true, loader: imageRouteUrl };
	if (delivery.kind === "route") return { loader: imageRouteUrl };

	const { widths } = delivery;

	return {
		loader: (props: ImageLoaderProps): string => widths[props.width] ?? imageRouteUrl(props),
	};
}

/**
 * Pairs a server-rendered `srcset` with the widths next/image derives from the same props,
 * which it lists in the same order (`widthsSrcSet` is that srcset with each width as its URL).
 * `undefined` when the two disagree.
 */
export function signedWidthsFromSrcSet(
	srcSet: string,
	widthsSrcSet: string,
): SignedWidths | undefined {
	const urls = srcSetUrls(srcSet);
	const widths = srcSetUrls(widthsSrcSet).map(Number);

	if (urls.length === 0 || urls.length !== widths.length) return undefined;

	return Object.fromEntries(widths.map((width, index) => [width, urls[index] ?? ""]));
}

// Next joins candidates with ", "; a signed URL must hold no space (encode the source).
function srcSetUrls(srcSet: string): string[] {
	return srcSet
		.split(", ")
		.map((candidate) => candidate.trim().split(" ")[0] ?? "")
		.filter(Boolean);
}

// The browser holds no key: /api/image signs and redirects.
export function imageRouteUrl({ src, width, quality }: ImageLoaderProps): string {
	const params = new URLSearchParams({
		src,
		w: String(width),
		q: String(quality ?? DEFAULT_QUALITY),
	});

	return `${IMAGE_ROUTE}?${params}`;
}

// Resolve as the browser will, not by prefix: `//host`, `/\host` and a tab or newline
// between the slashes all leave the origin despite the leading slash.
function isSameOriginPath(src: string): boolean {
	if (!src.startsWith("/")) return false;

	return parseRelative(src)?.origin === SAME_ORIGIN_PROBE;
}

function isSvg(src: string): boolean {
	return parseRelative(src)?.pathname.toLowerCase().endsWith(".svg") ?? false;
}

// Not URL.parse: this runs in the browser, and URL.parse is above the Safari 16.4 floor.
function parseRelative(src: string): URL | null {
	try {
		return new URL(src, SAME_ORIGIN_PROBE);
	} catch {
		return null;
	}
}
