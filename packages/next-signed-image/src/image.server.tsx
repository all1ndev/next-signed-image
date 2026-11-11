import { imageSigner } from "@all1ndev/next-signed-image/signer";
import { getImageProps } from "next/image";
import type { JSX } from "react";
import { preload } from "react-dom";

import { type ImageProps, nextImageDelivery, ROUTE, serverDelivery } from "./delivery.js";

export type { ImageProps } from "./delivery.js";

// The `react-server` branch: renders once, on the server, so it needs none of the client
// branch's hydration bookkeeping.
export function Image(props: Readonly<ImageProps>): JSX.Element {
	const delivery = serverDelivery(props, imageSigner) ?? ROUTE;
	const { props: imgProps } = getImageProps({ ...props, ...nextImageDelivery(delivery) });

	// getImageProps only computes attributes; next/image's own preload hint comes from its
	// component, which this <img> replaces, so the same options are passed here.
	if (props.preload === true) {
		preload(imgProps.src, {
			as: "image",
			imageSrcSet: imgProps.srcSet,
			imageSizes: imgProps.sizes,
			crossOrigin: imgProps.crossOrigin,
			referrerPolicy: imgProps.referrerPolicy,
			fetchPriority: imgProps.fetchPriority,
		});
	}

	return <img {...imgProps} alt={props.alt} />;
}
