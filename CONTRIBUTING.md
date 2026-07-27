# Contributing

Thank you for improving Push Row. By participating, you agree to follow the
[code of conduct](CODE_OF_CONDUCT.md).

## Development setup

Use Chrome, Node 24 LTS, and npm:

```bash
npm ci
npx playwright install chromium
npm run dev
```

The [architecture guide](docs/architecture.md) explains the runtime boundaries and source layout.
Use `npm run assets` after changing an SVG source or the settings UI.

## Making changes

1. Fork the repository and create a focused branch from `main`.
2. Keep runtime logic in its existing layer: entrypoints, background, UI, platform, shared domain, or
   integrations.
3. Add or update tests for parser, storage, routing, request, or UI behavior changes.
4. Update documentation when behavior, permissions, privacy, or the release package changes.
5. Use placeholder credentials and sanitized example URLs only.

Do not commit real webhook URLs, authentication values, private CRM URLs, or customer data.

## Verification

Run the complete automated suite before opening a pull request:

```bash
npm run check
npm run test:e2e
```

If browser E2E tests cannot run in your environment, explain why and provide the manual verification
performed. Changes affecting sends or local data should also follow the relevant portions of the
[manual release check](docs/manual-release-check.md).

## Pull requests

Pull requests should be small enough to review and should explain:

- The user-visible or developer-facing change.
- Tests and manual verification performed.
- Any browser permission or privacy impact.
- Documentation or migration considerations.

New permissions, remote code, telemetry, servers, scraping, automatic sends, or destinations beyond
Clay require explicit maintainer approval and corresponding documentation updates.
