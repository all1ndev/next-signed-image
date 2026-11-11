import { createHmac } from "node:crypto";

import type { ImageSigner } from "../src/delivery.ts";
import { defineImageSigner } from "../src/route.ts";

// A stand-in resizer: allowed sources are signed, CDN files are served as-is.
export const imageSigner: ImageSigner = defineImageSigner({
	delivery(src) {
		const origin = URL.parse(src)?.origin;
		if (origin === "https://files.example.com") return "as-is";
		return origin === "https://img.example.com" ? "sign" : "route";
	},
	sign({ src, width, quality }) {
		const path = `${width}x0/q${quality}/${encodeURIComponent(src)}`;
		const signature = createHmac("sha256", "test-key").update(path).digest("base64url");
		return `https://resizer.example.com/${signature}/${path}`;
	},
});
