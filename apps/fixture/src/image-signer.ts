import { createHmac } from "node:crypto";

import type { ImageSigner } from "@all1ndev/next-signed-image/delivery";
import { defineImageSigner } from "@all1ndev/next-signed-image/route";

const MARKER = "FIXTURE_SIGNER_MARKER";

export const imageSigner: ImageSigner = defineImageSigner({
	delivery(src) {
		const origin = URL.parse(src)?.origin;
		if (origin === "https://files.example.com") return "as-is";
		return origin === "https://img.example.com" ? "sign" : "route";
	},
	sign({ src, width, quality }) {
		const key = process.env["FAKE_SIGNING_SECRET_ZX81"];
		if (!key) throw new Error(`${MARKER}: FAKE_SIGNING_SECRET_ZX81 is not set`);
		const path = `${width}x0/q${quality}/${encodeURIComponent(src)}`;
		const signature = createHmac("sha256", key).update(path).digest("base64url");
		return `https://resizer.example.com/${signature}/${path}`;
	},
});
