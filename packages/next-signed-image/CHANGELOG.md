# Changelog

## Unreleased

- Fixed: under a `basePath`, images that go through the signing route requested `/api/image`
  instead of `<basePath>/api/image` and got a 404. `withSignedImages` now inlines the route's
  full path through Next's `env` config.

## 0.1.2 (2026-11-12)

- README: opens with the problem it solves, what each render path gets, and a quick start.
  No code changes.

## 0.1.1 (2026-11-12)

- Fixed: the built files imported `next/image` without an extension, which Node's ESM loader
  cannot resolve (next has no `exports` map), so a test runner loading the package natively
  failed with "Cannot find module …/next/image". `/route` no longer loads `next` at all.
- README: how to set up Vitest for tests that render `Image`.
- The package now compiles with `module: node20` and Node's module resolution, so an import
  that plain Node cannot resolve fails the typecheck.

## 0.1.0 (2026-11-12)

- `Image`: a `next/image` replacement that signs image URLs on the server. Server components
  get a `react-server` build (`getImageProps`, a plain `<img>`, a `preload()` hint); client
  components sign during SSR and hydrate from the server's `<img>` with no mismatch.
  `src` takes a URL or a static import, which is served as-is.
- `createImageRoute` and `defineImageSigner` (`/route`): the `/api/image` signing redirect.
- `withSignedImages` (`/config`): the Turbopack and webpack aliases that keep the signer out of
  the browser bundle, and the custom loader setup.
