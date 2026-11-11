import { expect, test, vi } from "vitest";

import { createImageRoute, defineImageSigner } from "../src/route.ts";
import { imageSigner } from "./signer.ts";

const GET = createImageRoute(imageSigner);

function get(query: Record<string, string>): Response {
	return GET(new Request(`http://localhost/api/image?${new URLSearchParams(query)}`));
}

test.each([
	["no src", { w: "640", q: "75" }],
	["a width next/image never requests", { src: "https://img.example.com/a.jpg", w: "641", q: "75" }],
	["an unconfigured quality", { src: "https://img.example.com/a.jpg", w: "640", q: "50" }],
])("answers 400 for %s", (_, query) => {
	expect(get(query).status).toBe(400);
});

test.each([
	["an unlisted origin", "https://evil.com/a.jpg"],
	["an SVG elsewhere (the built-in as-is rule is not the route's)", "https://evil.com/a.svg"],
])("answers 403 for %s", (_, src) => {
	expect(get({ src, w: "640", q: "75" }).status).toBe(403);
});

test("302s to the signed URL, never a permanent redirect", () => {
	const response = get({ src: "https://img.example.com/a.jpg", w: "640", q: "75" });
	expect(response.status).toBe(302);
	expect(response.headers.get("location")).toBe(imageSigner.sign({ src: "https://img.example.com/a.jpg", width: 640, quality: 75 }));
});

test("302s straight to an as-is file, normalized", () => {
	const response = get({ src: "https://files.example.com/./a b.jpg", w: "640", q: "75" });
	expect(response.status).toBe(302);
	expect(response.headers.get("location")).toBe("https://files.example.com/a%20b.jpg");
});

test("honours custom sizes", () => {
	const custom = createImageRoute(imageSigner, { sizes: { deviceSizes: [500], imageSizes: [], qualities: [50] } });
	const request = (w: string, q: string) => custom(new Request(`http://localhost/api/image?src=https://img.example.com/a.jpg&w=${w}&q=${q}`));
	expect(request("500", "50").status).toBe(302);
	expect(request("640", "75").status).toBe(400);
});

test.each([
	["a non-http as-is source", "javascript:alert(1)"],
	["an unparsable as-is source", "not a url"],
])("answers 403 for %s instead of redirecting to it", (_, src) => {
	const route = createImageRoute({ delivery: () => "as-is", sign: () => "unused" });
	expect(route(new Request(`http://localhost/api/image?${new URLSearchParams({ src, w: "640", q: "75" })}`)).status).toBe(403);
});

test("defineImageSigner refuses to run in a browser", () => {
	vi.stubGlobal("window", {});
	try {
		expect(() => defineImageSigner(imageSigner)).toThrow(/bundled for the browser/);
	} finally {
		vi.unstubAllGlobals();
	}
});
