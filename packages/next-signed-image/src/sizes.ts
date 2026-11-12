/** The widths and qualities next/image may request, and so the only ones the route signs. */
export type ImageSizes = {
	deviceSizes: number[];
	imageSizes: number[];
	qualities: number[];
};

export const DEFAULT_QUALITY = 75;

// Next's own defaults (`imageConfigDefault` in next/dist/shared/lib/image-config.js), pinned so
// a Next upgrade that changes them cannot desync the route from the loader.
export const defaultImageSizes: ImageSizes = {
	deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
	imageSizes: [32, 48, 64, 96, 128, 256, 384],
	qualities: [DEFAULT_QUALITY],
};

/** The signing route's path, before the app's `basePath`. */
export const IMAGE_ROUTE = "/api/image";
