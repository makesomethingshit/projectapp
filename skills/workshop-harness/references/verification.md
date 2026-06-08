# Verification Reference

Use the narrowest reliable checks first, then broaden as risk warrants.

## Project Commands

```bash
npm test
npm run dist
```

There are currently no `lint`, `typecheck`, or `build` scripts. Use `npm test` for automatic regression checks. Use `npm run dist` only when packaging or Electron build output is relevant.

If PowerShell blocks `npm test`, use:

```bash
npm.cmd test
```

## Check Selection

- Docs only: confirm files exist, inspect diff, ensure app source did not change.
- Korean text, HTML labels, JavaScript template strings, or CSS `content`: run or explicitly consider `node test_encoding_integrity.mjs`; also run `node --check <changed-js-file>` for changed JavaScript and a narrow markup/UI test when the string renders in the app.
- UI markup/style: run relevant markup tests or `npm test` when risk is not trivial.
- State, rollup, storage, import/export, graph semantics: run related tests and `npm test`.
- Packaging, `main.js`, `preload.js`, build config: run `npm test`; consider `npm run dist`.

## Completion Evidence

Final reports must include:

- Changed files.
- Affected behavior or documents.
- Assumptions.
- Remaining risks or questions.
- Commands run and pass/fail result.
- Reason for any skipped verification.
