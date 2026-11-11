import type { ImageSigner } from "./delivery.js";

// What `@all1ndev/next-signed-image/signer` resolves to on the server when the app's next.config
// does not alias it to the app's signer module: evaluating it throws.
function unconfigured(): never {
	throw new Error(
		'@all1ndev/next-signed-image: no image signer is configured. Wrap your next.config with withSignedImages(config, { signer: "./src/image-signer.ts" }) from "@all1ndev/next-signed-image/config", or alias "@all1ndev/next-signed-image/signer" to that module in your test runner.',
	);
}

export const imageSigner: ImageSigner | undefined = unconfigured();
