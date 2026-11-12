import { expect, test } from "vitest";

import { withSignedImages } from "../src/config.ts";

test("aliases the signer for Turbopack and webpack and forces a custom loader", () => {
	const config = withSignedImages(
		{ images: { loaderFile: "./old-loader.ts", remotePatterns: [] }, turbopack: { resolveAlias: { a: "b" } } },
		{ signer: "./src/image-signer.ts" },
	);

	expect(config.images).toMatchObject({ loader: "custom", remotePatterns: [], qualities: [75] });
	expect(config.images).not.toHaveProperty("loaderFile");
	expect(config.turbopack?.resolveAlias).toEqual({
		a: "b",
		"@all1ndev/next-signed-image/signer": {
			browser: "@all1ndev/next-signed-image/signer/browser",
			default: "./src/image-signer.ts",
		},
	});

	const alias = (isServer: boolean) =>
		config.webpack?.({ resolve: { alias: {} } }, { isServer, dir: "/app" } as never).resolve.alias[
			"@all1ndev/next-signed-image/signer$"
		];
	expect(alias(true)).toBe("/app/src/image-signer.ts");
	expect(alias(false)).toMatch(/signer\.browser\.js$/);
});

test("refuses to run unconfigured", async () => {
	await expect(import("../src/signer.default.ts")).rejects.toThrow(/withSignedImages/);
});

test.each([
	["without a basePath", {}, undefined, "/api/image"],
	["under a basePath", { basePath: "/shop" }, undefined, "/shop/api/image"],
	["at a custom route", {}, "/img", "/img"],
	["at a custom route under a basePath", { basePath: "/shop" }, "/img", "/shop/img"],
])("inlines the signing route's path %s", (_, nextConfig, route, path) => {
	const config = withSignedImages(
		{ ...nextConfig, env: { KEPT: "1" } },
		{ signer: "./s.ts", ...(route && { route }) },
	);
	expect(config.env).toEqual({ KEPT: "1", SIGNED_IMAGE_ROUTE: path });
});

test.each(["api/image", "/img?x=1", "/img#x", ""])("rejects the route %j", (route) => {
	expect(() => withSignedImages({}, { signer: "./s.ts", route })).toThrow(/route must be a path/);
});
