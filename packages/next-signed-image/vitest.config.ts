import { fileURLToPath } from "node:url";
import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
	resolve: {
		// What withSignedImages does for an app.
		alias: {
			"@all1ndev/next-signed-image/signer": fileURLToPath(new URL("./test/signer.ts", import.meta.url)),
		},
	},
	test: { environment: "node" },
});

export default config;
