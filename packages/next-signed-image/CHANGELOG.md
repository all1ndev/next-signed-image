# Changelog

## 0.1.0 (2026-11-12)

- `Image`: a `next/image` replacement that signs image URLs on the server. Server components
  get a `react-server` build (`getImageProps`, a plain `<img>`, a `preload()` hint); client
  components sign during SSR and hydrate from the server's `<img>` with no mismatch.
  `src` takes a URL or a static import, which is served as-is.
- `createImageRoute` and `defineImageSigner` (`/route`): the `/api/image` signing redirect.
- `withSignedImages` (`/config`): the Turbopack and webpack aliases that keep the signer out of
  the browser bundle, and the custom loader setup.
