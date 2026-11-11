# next-signed-image

A drop-in `next/image` replacement for image services that need server-side signed URLs.
Usage and API: [packages/next-signed-image](packages/next-signed-image/README.md).

| Path                         | What                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `packages/next-signed-image` | `@all1ndev/next-signed-image`, the published package               |
| `apps/fixture`               | a Next app that uses the built package, to prove what tests can't  |

## Development

```sh
pnpm install
pnpm typecheck       # builds the package, then typechecks it and the fixture
pnpm test            # unit tests
pnpm check:pack      # packs like `pnpm publish` and checks what ships
pnpm check:esm       # imports every entry point of dist under plain Node ESM
pnpm check:fixture   # builds the fixture with Turbopack and webpack; no signer in the browser
pnpm fixture:dev -p 3999
node apps/fixture/hydration-probe.cjs <dir with @playwright/test> http://localhost:3999/
```

CI (`.github/workflows/ci.yml`) runs everything above except the hydration probe, on Node 22,
24 and 26.

The fixture resolves the package through its `exports`, so it runs the built `dist`, not the
source. `check:fixture` also builds it with `FIXTURE_CONTROL=unaliased` (must fail with the
setup error) and `FIXTURE_CONTROL=leak` (must leak), so the checks are shown to catch both.

## License

MIT
