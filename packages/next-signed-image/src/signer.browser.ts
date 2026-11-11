import type { ImageSigner } from "./delivery.ts";

// The browser branch of `@all1ndev/next-signed-image/signer`: the browser holds no key, so a client
// `Image` reads its server's decision back from the hydrated <img> instead.
export const imageSigner: ImageSigner | undefined = undefined;
