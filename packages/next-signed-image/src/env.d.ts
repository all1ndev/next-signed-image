// Inlined at build time by withSignedImages, through Next's `env` config (see config.ts).
declare global {
	namespace NodeJS {
		interface ProcessEnv {
			readonly SIGNED_IMAGE_ROUTE?: string;
		}
	}
}

export {};
