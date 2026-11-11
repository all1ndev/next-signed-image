# @all1ndev/next-signed-image

A drop-in [`next/image`](https://nextjs.org/docs/app/api-reference/components/image)
replacement for image services that only accept URLs signed with a server-side secret:
[Thumbor](https://www.thumbor.org/), [imgproxy](https://imgproxy.net/), signed imgix,
Cloudinary or S3 URLs.

- Server components and server-rendered client components get **signed URLs directly**, with
  no redirect hop, your LCP image included.
- Client components **hydrate without a mismatch**: the browser reads the signed `srcset` back
  from the server's `<img>` instead of trying to sign.
- Only an image that **first renders in the browser** (after a click or a soft navigation)
  goes through `/api/image`, which signs and answers `302`.
- The signer and its secret **never reach the browser bundle**.

Requires Next.js 16+, React 19+, App Router.

## Install

```sh
npm install @all1ndev/next-signed-image
```

## Usage

### 1. Write the signer

The signer is your own module, so your app keeps its env, its secrets and its source policy.
It must export `imageSigner`:

```ts
// src/image-signer.ts
import { defineImageSigner } from "@all1ndev/next-signed-image/route";

export const imageSigner = defineImageSigner({
	delivery(src) {
		const origin = URL.parse(src)?.origin;
		if (origin === "https://cdn.example.com") return "as-is"; // already display-sized
		if (origin === "https://photos.example.com") return "sign";
		return "route"; // refused: /api/image answers 403
	},
	sign({ src, width, quality }) {
		return signWithYourService(src, width, quality, process.env.IMAGE_SIGNING_KEY);
	},
});
```

### 2. Wrap the Next config

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

### 3. Add the route

```ts
// src/app/api/image/route.ts
import { createImageRoute } from "@all1ndev/next-signed-image/route";

import { imageSigner } from "@/image-signer";

export const GET = createImageRoute(imageSigner);
```

### 4. Render images

```tsx
import { Image } from "@all1ndev/next-signed-image";

<Image src="https://photos.example.com/car.jpg" alt="" width={640} height={480} preload />;
```

`Image` takes the `next/image` props except `loader` and `unoptimized`. Use it from server and
client components alike. A static import (`import hero from "./hero.png"`) is a same-origin
file, so it is served as-is with its intrinsic size, and the signer is never asked.

## The signer contract

```ts
type ImageSigner = {
	delivery(src: string): "as-is" | "sign" | "route";
	sign(image: { src: string; width: number; quality: number }): string;
};
```

| `delivery(src)` | Server render                                | `/api/image`                           |
| --------------- | -------------------------------------------- | -------------------------------------- |
| `"sign"`        | `sign()` for each width next/image asks for  | `302` to `sign()`                      |
| `"as-is"`       | the URL itself, `unoptimized`                | `302` to the normalized http(s) URL    |
| `"route"`       | points at `/api/image` (one broken image)    | `403`                                  |

Same-origin paths (`/public` files, static imports) and `.svg` sources are always served
as-is, before the signer is asked, because the browser has to reach the same decision without
it. The route never applies that rule: it trusts only `delivery()`.

`sign()` is called only after `delivery()` returned `"sign"`, so it is the place to enforce
your source policy again. Sign the normalized URL, not the raw input, and encode it so the
signed URL holds no space (a `srcset` separates candidates with spaces).

`defineImageSigner` returns the signer unchanged and throws if the module is ever evaluated in
a browser, standing in for `server-only`, which a client component's SSR pass cannot import.

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

The `THUMBOR_*` variables belong to your app. Read them lazily (inside the functions), so a
build without them still succeeds.

## Sizes and qualities

`withSignedImages` sets `images.deviceSizes`, `imageSizes` and `qualities` (Next's defaults,
quality 75 only), and the route signs exactly those. To change them, pass **the same object**
to both, since a width the route rejects breaks every browser-rendered image:

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
`react-server` build, which renders once: it runs `getImageProps` with a signing loader,
renders a plain `<img>` and, for `preload`, calls React DOM's `preload()` (getImageProps
emits no preload hint of its own). Client components resolve the `default` build, which
renders twice, on the server and in the browser, and must produce the same attributes both
times. It decides how to deliver the image once per mount, in a lazy `useState` initializer:

```ts
serverDelivery(props, imageSigner) ?? // SSR: sign (the signer is a stub in the browser)
	hydratedDelivery(props, useId()) ?? // hydration: read the server's decision from the DOM
	browserDelivery(props.src); // browser-only render: as-is, or the /api/image redirect
```

The server-rendered `<img>` carries `data-image-id` (from `useId`, identical in the server
render and during hydration) and `data-image-delivery`. While hydrating, the initializer finds
that `<img>` and pairs its `srcset` URLs with the widths next/image derives from the same
props. If the two lists differ in length, it falls back to the redirect rather than guess.

The signer reaches the package through the specifier `@all1ndev/next-signed-image/signer`.
`withSignedImages` aliases it, for Turbopack and webpack, to your module on the server and to
a stub that exports `undefined` in the browser. Without the alias, it resolves to a module
that throws a "wrap your next.config with withSignedImages" error.

Every render passes a `loader`: with `images.loader: "custom"` and no `loaderFile`, Next throws
"missing loader" before it reads `unoptimized`. That also makes a stray `next/image` fail
loudly instead of reaching `/_next/image`.

## Caveats

- **Extra attributes.** A client `Image` renders `data-image-id` and `data-image-delivery` on
  its `<img>`.
- **A DOM read during the first browser render.** Hydration calls
  `document.querySelector` inside the `useState` initializer. It reads only the element React
  is about to hydrate, and only once per mount.
- **Changing `src`.** A client `Image` whose `src` changes after mount goes through
  `/api/image`: the browser cannot sign.
- **Env in prerendered shells.** Any server render of a signed source calls your signer, so
  if it reads env, the usual rules apply (`await connection()` inside a prerendered shell).
- **`basePath`.** The route path is fixed at `/api/image`, without a `basePath` prefix.
- **Test runners.** `/route`, `/delivery` and `/config` load under plain Node ESM, so a route
  test needs no setup. A test that renders `Image` must alias `@all1ndev/next-signed-image/signer`
  to a signer module, as `withSignedImages` does for Next, and must inline the package, because
  a test runner applies aliases only to code it transforms. With Vitest:

  ```ts
  export default defineConfig({
  	resolve: { alias: { "@all1ndev/next-signed-image/signer": "./src/image-signer.ts" } },
  	test: { server: { deps: { inline: ["@all1ndev/next-signed-image"] } } },
  });
  ```
- **Browser support.** Client code stays within the Safari 16.4 API floor (no `URL.parse`,
  `Object.groupBy` or `Promise.withResolvers`).

## License

MIT
