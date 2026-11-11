import { getImageProps } from "next/image";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { type ImageProps, nextImageDelivery, serverDelivery, signedWidthsFromSrcSet } from "../src/delivery.js";
import { Image } from "../src/image.client.js";
import { Image as ServerImage } from "../src/image.server.js";
import { imageSigner } from "./signer.js";

const FIXED = { alt: "", width: 256, height: 192 } as const;
const FILL = { alt: "", fill: true, sizes: "(min-width: 1024px) 272px, 90vw" } as const;

function ssr(component: typeof Image, props: ImageProps): string {
	return renderToStaticMarkup(createElement(component, props));
}

function attribute(html: string, name: string): string {
	return (html.match(new RegExp(` ${name}="([^"]*)"`, "i"))?.[1] ?? "").replaceAll("&amp;", "&");
}

test.each([
	["a same-origin asset", "/logo.png", "as-is"],
	["a protocol-relative URL, which only the signer can decide", "//img.example.com/a.jpg", "route"],
	["an SVG, before the signer is asked", "https://evil.com/logo.svg", "as-is"],
	["a file the signer serves as-is", "https://files.example.com/a.jpg", "as-is"],
	["an unlisted origin", "https://evil.com/a.jpg", "route"],
	["an allowed origin", "https://img.example.com/a.jpg", "signed"],
])("delivers %s %s", (_, src, kind) => {
	expect(serverDelivery({ ...FIXED, src }, imageSigner)?.kind).toBe(kind);
});

test("has no delivery without a signer (the browser stub)", () => {
	expect(serverDelivery({ ...FIXED, src: "https://img.example.com/a.jpg" }, undefined)).toBeUndefined();
});

test("signs exactly the widths next/image requests for the layout", () => {
	const delivery = serverDelivery({ ...FIXED, src: "https://img.example.com/a.jpg" }, imageSigner);
	expect(Object.keys(delivery?.kind === "signed" ? delivery.widths : {})).toEqual(["256", "640"]);
});

test.each([
	["client", Image],
	["react-server", ServerImage],
] as const)("the %s Image renders each kind of delivery", (_, component) => {
	const signed = ssr(component, { ...FILL, src: "https://img.example.com/a.jpg" });
	expect(attribute(signed, "srcset")).toContain("https://resizer.example.com/");
	expect(signed).not.toContain("/api/image");

	const route = ssr(component, { ...FIXED, src: "https://evil.com/a.jpg" });
	expect(attribute(route, "src")).toBe("/api/image?src=https%3A%2F%2Fevil.com%2Fa.jpg&w=640&q=75");

	const asIs = ssr(component, { ...FIXED, src: "https://files.example.com/a.jpg" });
	expect(attribute(asIs, "src")).toBe("https://files.example.com/a.jpg");
	expect(asIs).not.toMatch(/srcset/i);
});

test("the client Image tags its <img> for hydration", () => {
	const html = ssr(Image, { ...FIXED, src: "https://img.example.com/a.jpg" });
	expect(attribute(html, "data-image-delivery")).toBe("signed");
	expect(attribute(html, "data-image-id")).not.toBe("");
});

// What hydration does in the browser: rebuild the delivery from the server's srcset, then
// render. Anything but the same srcset would be a hydration mismatch.
test.each([
	["a fill layout", FILL],
	["a fixed width", FIXED],
	["a non-default quality", { ...FIXED, quality: 50 }],
])("rebuilds the server's srcset exactly from the hydrated <img>, for %s", (_, layout) => {
	const props = { ...layout, src: "https://img.example.com/a.jpg" };
	const serverSrcSet = attribute(ssr(Image, props), "srcset");
	const widthsSrcSet = getImageProps({ ...props, loader: ({ width }) => String(width) }).props.srcSet;
	const widths = signedWidthsFromSrcSet(serverSrcSet, widthsSrcSet ?? "");

	expect(widths).toBeDefined();
	expect(serverSrcSet).toContain(`/q${"quality" in props ? props.quality : 75}/`);

	const browserSrcSet = getImageProps({
		...props,
		...nextImageDelivery({ kind: "signed", widths: widths ?? {} }),
	}).props.srcSet;

	expect(browserSrcSet).toBe(serverSrcSet);
});

test("refuses a srcset whose length disagrees with the layout", () => {
	expect(signedWidthsFromSrcSet("https://a/1 1x", "256 1x, 640 2x")).toBeUndefined();
});

test("emits a preload hint for a preloaded image, as next/image does", () => {
	const html = ssr(ServerImage, { ...FIXED, src: "https://img.example.com/a.jpg", preload: true });
	expect(html).toMatch(/<link rel="preload"[^>]* as="image"/);
	expect(html).toContain('imageSrcSet="https://resizer.example.com/');
});

test("emits no preload hint otherwise", () => {
	expect(ssr(ServerImage, { ...FIXED, src: "https://img.example.com/a.jpg" })).not.toContain('rel="preload"');
});

// What `import hero from "./hero.png"` gives: Next's StaticImageData, or `{ default }` from a
// require. Same-origin files, so served as-is without asking the signer.
const STATIC = { src: "/_next/static/media/hero.0a1b2c.png", width: 800, height: 600 };

test.each([
	["a static import", STATIC],
	["a static require", { default: STATIC }],
])("serves %s as-is without asking the signer", (_, src) => {
	const signer = {
		delivery: (): never => {
			throw new Error("asked");
		},
		sign: (): never => {
			throw new Error("asked");
		},
	};
	expect(serverDelivery({ alt: "", src }, signer)?.kind).toBe("as-is");
});

test.each([
	["client", Image],
	["react-server", ServerImage],
] as const)("the %s Image renders a static import with its intrinsic size", (_, component) => {
	const html = renderToStaticMarkup(createElement(component, { alt: "", src: STATIC }));
	expect(attribute(html, "src")).toBe(STATIC.src);
	expect(attribute(html, "width")).toBe("800");
	expect(attribute(html, "height")).toBe("600");
	expect(html).not.toMatch(/srcset/i);
});
