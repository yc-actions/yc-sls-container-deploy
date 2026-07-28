# Verification

To verify everything is working correctly, run:

```bash
npm run all
```

This will:

1.  Format the code with Prettier
2.  Lint with ESLint
3.  Run all tests
4.  Generate the coverage badge
5.  Bundle with Rollup into `dist/`

There is no standalone `tsc --noEmit` script; type checking happens incidentally via `@rollup/plugin-typescript` during
the bundle step and via ts-jest during tests. Run `npx tsc --noEmit` directly if you want a standalone typecheck.
