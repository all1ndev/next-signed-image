# Contributing

Thanks for helping. This is a pnpm workspace:

| Path                         | What                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `packages/next-signed-image` | `@all1ndev/next-signed-image`, the published package               |
| `apps/fixture`               | a Next app that uses the built package, to prove what tests can't  |

The root `README.md` is a symlink to the package's README, which is what npm shows. Edit
`packages/next-signed-image/README.md`, and use absolute links in it: the same file renders at
the repo root, in the package folder and on npm.

## Development

Requires Node 22+ and pnpm, at the version pinned in `package.json`.

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

## Releasing

Bump `version` in `packages/next-signed-image/package.json`, add a `CHANGELOG.md` entry, and
run `pnpm install` (the workspace checks its dependencies before every script). Once CI is
green, publish from `packages/next-signed-image` with `pnpm publish --access public`, which
asks for 2FA, then tag the commit `vX.Y.Z`.
