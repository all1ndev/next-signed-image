# next-signed-image

[![npm](https://img.shields.io/npm/v/@all1ndev/next-signed-image)](https://www.npmjs.com/package/@all1ndev/next-signed-image)
[![CI](https://github.com/all1ndev/next-signed-image/actions/workflows/ci.yml/badge.svg)](https://github.com/all1ndev/next-signed-image/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@all1ndev/next-signed-image)](https://github.com/all1ndev/next-signed-image/blob/main/LICENSE)

**`next/image` for image services that only accept signed URLs**, such as
[Thumbor](https://www.thumbor.org/), [imgproxy](https://imgproxy.net/), or signed imgix,
Cloudinary and S3 URLs. It signs on the server, hydrates without a mismatch, and never lets the
key near the browser.

```tsx
import { Image } from "@all1ndev/next-signed-image";

<Image src="https://photos.example.com/car.jpg" alt="" width={640} height={480} preload />;
```

## The problem

Your resizer wants an HMAC-signed URL. `next/image` builds its URLs in a `loader`, and a client
component runs that loader in the browser too, where the key can't go. The usual workaround
sends every image through a route that signs and redirects:

```text
<img src="/api/image?src=…&w=640">  →  302  →  https://resizer/…signed…/640x0/…
```

That works, but every image pays an extra round trip, your LCP image included. Signing on the
server and putting the signed URLs straight into the HTML is the obvious fix, until you notice
that a client component renders twice. The server signs, the browser can't, React compares the
two and warns:

```text
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
```

## What this package does

| The image renders…                                   | It gets                                         |
| ---------------------------------------------------- | ----------------------------------------------- |
| in a **server component**                            | signed URLs in a plain `<img>`, no client JS     |
| in a **client component**, on the server             | signed URLs, signed during SSR                  |
| in that client component, **hydrating**              | the same URLs, read back from the server's HTML |
| in the browser **first** (after a click, a soft nav) | `/api/image`, which signs and answers `302`     |

- **No redirect hop** for anything the server renders, so the HTML holds the final URLs.
- **No hydration mismatch**, with no `suppressHydrationWarning` and no inline script.
- **The key stays on the server.** The signer resolves to a stub in the browser bundle, and
  throws if it ever lands there. This repo's CI builds a Next app with Turbopack and webpack and
  greps its browser bundle to prove it.
- **Exactly the widths `next/image` asks for**, and a signing route that refuses everything else.
- **Bring your own resizer.** You write two functions; the package does the rest.

Requires Next.js 16+ (App Router), React 19+ and Node 22+.

## Quick start

```sh
npm install @all1ndev/next-signed-image
```

**1. Write the signer.** It's your module, so your app keeps its env, its secret and its source
policy. Export it as `imageSigner`:

```ts
// src/image-signer.ts
import { defineImageSigner } from "@all1ndev/next-signed-image/route";

export const imageSigner = defineImageSigner({
	delivery(src) {
		const origin = URL.parse(src)?.origin;
		if (origin === "https://cdn.example.com") return "as-is"; // already display-sized
		if (origin === "https://photos.example.com") return "sign";
		return "route"; // refused: never signed, /api/image answers 403
	},
	sign({ src, width, quality }) {
		return signWithYourService(src, width, quality, process.env.IMAGE_SIGNING_KEY);
	},
});
```

**2. Wrap the Next config.** This points the package at your signer on the server and at a stub
in the browser, for Turbopack and webpack:

```ts
// next.config.ts
import { withSignedImages } from "@all1ndev/next-signed-image/config";

export default withSignedImages(
	{
		/* your config */
	},
	{ signer: "./src/image-signer.ts" },
);
```

**3. Add the signing route** for images that first render in the browser. It lives at
`/api/image`; under a `basePath`, the loader adds the prefix for you. To mount it elsewhere, pass
the path (without `basePath`) as `withSignedImages(config, { signer, route: "/img" })`:

```ts
// src/app/api/image/route.ts
import { createImageRoute } from "@all1ndev/next-signed-image/route";

import { imageSigner } from "@/image-signer";

export const GET = createImageRoute(imageSigner);
```

**4. Use `Image`** from server and client components alike. It takes the `next/image` props
except `loader` and `unoptimized`. `src` is a URL or a static import
(`import hero from "./hero.png"`), which is served as-is at its intrinsic size.

## The signer contract

```ts
type ImageSigner = {
	delivery(src: string): "as-is" | "sign" | "route";
	sign(image: { src: string; width: number; quality: number }): string;
};
```

`delivery(src)` is your source policy. Its answer decides what the server puts in the HTML, and
what `/api/image` answers when the browser asks for the image:

| `delivery(src)` | Meaning                                | Server render                               | `/api/image`                        |
| --------------- | -------------------------------------- | ------------------------------------------- | ----------------------------------- |
| `"sign"`        | allowed, resize it                     | `sign()` for each width next/image asks for | `302` to `sign()`                   |
| `"as-is"`       | allowed, already the right size        | the URL itself, `unoptimized`               | `302` to the normalized http(s) URL |
| `"route"`       | **refused**: not a source you serve    | a `/api/image` URL, nothing signed          | `403`, so the image shows as broken |

**Why refuse with a `403`.** `/api/image` is a public URL: anyone can call it with any `src`. If it
signed whatever it was given, it would turn your resizer into a free image proxy for the whole
internet, on your bill, and your domain into an open redirect. So the route signs or redirects
only what `delivery()` allows, and answers every other source with `403 Forbidden`. A `403` in
your app means a source is missing from your policy. A malformed request (no `src`, or a width or
quality outside your [sizes](#sizes-and-qualities)) gets `400 Bad Request` instead.

Same-origin paths (`/public` files, static imports) and `.svg` sources are always served as-is,
before the signer is asked, because the browser has to reach the same decision without it. The
route never applies that rule: it trusts only `delivery()`.

`sign()` is called only after `delivery()` returned `"sign"`, so it is the place to enforce your
source policy again. Sign the normalized URL, not the raw input, and encode it so the signed URL
holds no space (a `srcset` separates candidates with spaces).

`defineImageSigner` returns the signer unchanged and throws if the module is ever evaluated in a
browser. It stands in for `server-only`, which a client component's SSR pass cannot import.

### Example: Thumbor

With [`thumbor-client`](https://www.npmjs.com/package/thumbor-client) (any HMAC-SHA1
implementation works):

```ts
import { defineImageSigner } from "@all1ndev/next-signed-image/route";
import { createThumbor } from "thumbor-client";

const thumbor = createThumbor({ url: process.env.THUMBOR_URL!, key: process.env.THUMBOR_KEY! });
const allowed = new Set(process.env.THUMBOR_ALLOWED_SOURCE_ORIGINS!.split(","));

export const imageSigner = defineImageSigner({
	delivery: (src) => (allowed.has(URL.parse(src)?.origin ?? "") ? "sign" : "route"),
	sign({ src, width, quality }) {
		const source = new URL(src);
		if (!allowed.has(source.origin)) throw new Error(`Not an allowed image source: ${src}`);
		return thumbor
			.image(source.href, { encode: true })
			.resize(width, 0)
			.quality(quality)
			.noUpscale()
			.url();
	},
});
```

The `THUMBOR_*` variables belong to your app. Read them lazily (inside the functions), so a build
without them still succeeds.

## Sizes and qualities

`withSignedImages` sets `images.deviceSizes`, `imageSizes` and `qualities` (Next's defaults,
quality 75 only), and the route signs exactly those. To change them, pass **the same object** to
both, since a width the route rejects breaks every browser-rendered image:

```ts
// src/image-sizes.ts
import { defaultImageSizes } from "@all1ndev/next-signed-image/config";

export const sizes = { ...defaultImageSizes, qualities: [50, 75] };
```

```ts
withSignedImages(config, { signer: "./src/image-signer.ts", sizes });
createImageRoute(imageSigner, { sizes });
```

## How it works

`@all1ndev/next-signed-image` is a conditional export. Server components resolve its
`react-server` build, which renders once: it runs `getImageProps` with a signing loader, renders
a plain `<img>` and, for `preload`, calls React DOM's `preload()` (getImageProps emits no preload
hint of its own).

Client components resolve the `default` build, which renders twice, on the server and in the
browser, and must produce the same attributes both times. It decides how to deliver the image
once per mount, in a lazy `useState` initializer:

```ts
serverDelivery(props, imageSigner) ?? // SSR: sign (the signer is a stub in the browser)
	hydratedDelivery(props, useId()) ?? // hydration: read the server's decision from the DOM
	browserDelivery(props.src); // browser-only render: as-is, or the /api/image redirect
```

The server-rendered `<img>` carries `data-image-id` (from `useId`, identical in the server render
and during hydration) and `data-image-delivery`. While hydrating, the initializer finds that
`<img>` and pairs its `srcset` URLs with the widths next/image derives from the same props. If the
two lists differ in length, it falls back to the redirect rather than guess.

The signer reaches the package through the specifier `@all1ndev/next-signed-image/signer`.
`withSignedImages` aliases it to your module on the server and to a stub that exports `undefined`
in the browser. Without the alias, it resolves to a module that throws a "wrap your next.config
with withSignedImages" error.

Every render passes a `loader`: with `images.loader: "custom"` and no `loaderFile`, Next throws
"missing loader" before it reads `unoptimized`. That also makes a stray `next/image` fail loudly
instead of reaching `/_next/image`.

## Caveats

- **Extra attributes.** A client `Image` renders `data-image-id` and `data-image-delivery` on its
  `<img>`.
- **A DOM read during the first browser render.** Hydration calls `document.querySelector` inside
  the `useState` initializer. It reads only the element React is about to hydrate, and only once
  per mount.
- **Changing `src`.** A client `Image` whose `src` changes after mount goes through `/api/image`:
  the browser cannot sign.
- **Env in prerendered shells.** Any server render of a signed source calls your signer, so if it
  reads env, the usual rules apply (`await connection()` inside a prerendered shell).
- **Test runners.** `/route`, `/delivery` and `/config` load under plain Node ESM, so a route test
  needs no setup. A test that renders `Image` must alias `@all1ndev/next-signed-image/signer` to a
  signer module, as `withSignedImages` does for Next, and must inline the package, because a test
  runner applies aliases only to code it transforms. With Vitest:

  ```ts
  export default defineConfig({
  	resolve: { alias: { "@all1ndev/next-signed-image/signer": "./src/image-signer.ts" } },
  	test: { server: { deps: { inline: ["@all1ndev/next-signed-image"] } } },
  });
  ```

- **Browser support.** Client code stays within the Safari 16.4 API floor (no `URL.parse`,
  `Object.groupBy` or `Promise.withResolvers`).

## Contributing

See [CONTRIBUTING.md](https://github.com/all1ndev/next-signed-image/blob/main/CONTRIBUTING.md).

## License

[MIT](https://github.com/all1ndev/next-signed-image/blob/main/LICENSE)
