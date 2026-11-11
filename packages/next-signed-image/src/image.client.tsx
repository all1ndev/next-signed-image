import { imageSigner } from "@all1ndev/next-signed-image/signer";
import nextImage, { getImageProps } from "next/image.js";
import { type JSX, useId, useState } from "react";

import {
	AS_IS,
	browserDelivery,
	type Delivery,
	type ImageProps,
	nextImageDelivery,
	ROUTE,
	serverDelivery,
	signedWidthsFromSrcSet,
	srcUrl,
} from "./delivery.ts";

// next/image is CommonJS: a bundler's default import is the component, while Node's is
// `module.exports`, whose `default` is the component.
const NextImage = "default" in nextImage ? nextImage.default : nextImage;

export type { ImageProps } from "./delivery.ts";

/**
 * The `default` branch, for client components. Rendered on the server (SSR) it signs;
 * hydrating, it reuses what the server rendered; only an image that first renders in the
 * browser goes through the /api/image redirect.
 */
export function Image(props: Readonly<ImageProps>): JSX.Element {
	const id = useId();
	const src = srcUrl(props.src);
	// Lazy, once per mount: the first browser render must match the server's markup, and
	// later renders keep that decision rather than falling back to the redirect.
	const [first] = useState(() => ({
		src,
		delivery:
			serverDelivery(props, imageSigner) ??
			hydratedDelivery(props, id) ??
			browserDelivery(src),
	}));
	const delivery = first.src === src ? first.delivery : browserDelivery(src);

	return (
		<NextImage
			{...props}
			{...nextImageDelivery(delivery)}
			alt={props.alt}
			data-image-delivery={delivery.kind}
			data-image-id={id}
		/>
	);
}

// `useId` matches between the server render and hydration, and a browser-only render gets a
// different one, so finding the element means this render is hydrating it.
function hydratedDelivery(props: Readonly<ImageProps>, id: string): Delivery | undefined {
	if (typeof document === "undefined") return undefined;

	const img = document.querySelector(`img[data-image-id="${CSS.escape(id)}"]`);
	const kind = img?.getAttribute("data-image-delivery");

	if (kind === "as-is") return AS_IS;
	if (kind === "route") return ROUTE;
	if (kind !== "signed") return undefined;

	const { srcSet: widthsSrcSet } = getImageProps({
		...props,
		loader: ({ width }) => String(width),
	}).props;
	const widths = signedWidthsFromSrcSet(img?.getAttribute("srcset") ?? "", widthsSrcSet ?? "");

	return widths && { kind: "signed", widths };
}
