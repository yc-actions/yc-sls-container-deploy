# Changelog

## 5.0.0

### Changed

- Repository restructured onto the `actions/typescript-action` template: ESM source bundled with Rollup, `__fixtures__`
  test doubles, and the template's CI workflows. **No change to action inputs, outputs, or deployment behavior.**
- `check-dist` now rebuilds the bundle it verifies. Previously it built `lib/` and compared `dist/`, so a stale
  `dist/index.js` could be merged.
- `dist/` no longer ships the `@grpc/grpc-js` `.proto` files. They were only reachable through channelz and ORCA load
  reporting, neither of which a client-only action enables.
- `dist/licenses.txt` is no longer generated. It was an artifact of ncc; Rollup does not produce one.

### Security

- `@actions/github` bumped from `7` to `9`, clearing nine `undici` advisories that reached the bundle transitively. The
  action uses this package only to read `context.repo`, and the recorded request payloads are unchanged.

### Notes

- The `node24` runtime requirement is unchanged from `v4` — `action.yml` already declared it.
- Nothing consumer-visible breaks in this release. The major version marks the internal rewrite. The floating `v4` tag
  is not moved; pin `@v5` to pick this up.
