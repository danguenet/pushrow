<div align="center">
  <img src="src/public/icon-128.png" alt="Push Row icon" width="96" height="96">

# Push Row

**CRM records to Clay, in one click.**

[![License: MIT](https://img.shields.io/badge/license-MIT-3157D5.svg)](LICENSE)
[![Build and test](https://github.com/danguenet/pushrow/actions/workflows/build-and-release.yml/badge.svg)](https://github.com/danguenet/pushrow/actions/workflows/build-and-release.yml)
[![GitHub release](https://img.shields.io/github/v/release/danguenet/pushrow?display_name=tag&sort=semver)](https://github.com/danguenet/pushrow/releases)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](.nvmrc)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](wxt.config.ts)

</div>

Push Row is a privacy-focused Chrome extension for pushing LinkedIn and CRM records to [Clay](https://www.clay.com/) webhooks. It recognizes the active record from its URL, recommends a destination using your routing rules, and sends only when you click **Send**.

**Project status:** stable release (`1.0.x`). Push Row supports desktop Chrome only and is not yet
distributed through the Chrome Web Store.

![Push Row destination settings](store-assets/screenshot-1280x800.png)

## Highlights

- **URL-only record detection** — no content scripts and no page scraping.
- **Multiple Clay destinations** — save a named webhook for each table.
- **Smart routing** — recommend destinations by source, object type, or URL pattern.
- **Local by design** — settings, optional tokens, and bounded send activity stay in Chrome extension storage.
- **Controllable activity** — review the latest 10 requests and results by default, keep up to 100, or turn history off.
- **Manual sends only** — no background collection, automatic sends, or retries.
- **Minimal permissions** — only `activeTab`, `storage`, and optional access to Clay's API.

## Supported records

| Source     | Recognized pages                     | `object_type`                             |
| ---------- | ------------------------------------ | ----------------------------------------- |
| LinkedIn   | Profile pages                        | `person`                                  |
| HubSpot    | Standard and custom CRM record pages | Friendly standard type or HubSpot type ID |
| Salesforce | Lightning record pages               | Salesforce object API name                |
| Attio      | Workspace record pages               | Attio object slug                         |

Each send is one JSON `POST` containing exactly four fields:

```json
{
  "source": "salesforce",
  "url": "https://example.my.salesforce.com/lightning/r/Contact/003000000000000AAA/view",
  "record_id": "003000000000000AAA",
  "object_type": "Contact"
}
```

LinkedIn profiles do not expose a stable record ID in the URL, so `record_id` is `null` for that source.

## Install

### From a GitHub release

1. Download `pushrow-<version>-chrome.zip` from the [latest release](https://github.com/danguenet/pushrow/releases/latest).
2. Extract the archive to a permanent local folder.
3. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
4. Select the extracted folder.

Chrome does not update locally loaded extensions automatically. Repeat these steps when installing
a newer release.

### From source

You need Chrome, [Node.js 24](https://nodejs.org/), and npm:

```bash
git clone https://github.com/danguenet/pushrow.git
cd pushrow
npm ci
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/`.

For live development, run `npm run dev`; WXT will open a development browser profile with the extension loaded.

## Configure and use

1. Open Push Row's settings and add a named Clay destination.
2. Paste the table's webhook URL or Clay cURL command.
3. Review the locally parsed URL and optional authentication header, then save.
4. Optionally add guided or regular-expression routing rules.
5. Open a supported record, click Push Row in the toolbar, choose a table, and click **Send**.

Pasted cURL commands are parsed as text and never executed. Their request bodies are ignored.

## Privacy and security

Push Row has no operated server, account system, analytics, telemetry, or ads. It does not read page content, cookies, or browsing history. Destinations, optional authentication values, rules, and a configurable local activity log are stored on this device in `chrome.storage.local`, which is private to the extension but not encrypted at rest. Activity contains the four-field request and result, never the webhook URL or authentication value, and can be limited, cleared, or turned off.

The production manifest requests `activeTab` and `storage`. Access to `https://api.clay.com/*` is optional and requested when you save your first destination.

Read the [privacy policy](PRIVACY.md), [permission rationale](docs/permissions.md), [architecture and trust boundaries](docs/architecture.md), and [security policy](SECURITY.md) for details.

## Development

```bash
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
```

`npm run check` runs linting, formatting checks, TypeScript, unit tests, a production build, and package validation. Use `npm run zip` to create a release archive in the repository root.

Run `npm run assets` after changing an SVG source or the settings UI. It regenerates the icons,
promotional graphics, and repository social preview, builds the extension, and captures the store
screenshot from the actual options page.

Pull requests, pushes to `main`, version tags, and manual runs execute one build-and-release workflow.
Successful runs retain a verified `pushrow-<version>-chrome.zip` artifact and SHA-256 checksum for 14
days. A matching `v<version>` tag publishes that exact verified archive to a GitHub Release without
rebuilding it.

Before a release, complete the [manual user-owned webhook check](docs/manual-release-check.md). Tests and fixtures must contain placeholder credentials only.

## Support and contributions

- Report reproducible problems with the [bug report form](https://github.com/danguenet/pushrow/issues/new?template=bug_report.yml).
- Suggest improvements with the [feature request form](https://github.com/danguenet/pushrow/issues/new?template=feature_request.yml).
- Review the [contribution guide](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before opening a pull request.
- Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/danguenet/pushrow/security/advisories/new), not a public issue.

## Project documentation

- [Architecture](docs/architecture.md)
- [Brand system](docs/brand.md)
- [Changelog](CHANGELOG.md)
- [Permission rationale](docs/permissions.md)
- [Privacy policy](PRIVACY.md)
- [Chrome Web Store copy](docs/store-listing.md)
- [Release verification](docs/manual-release-check.md)
- [Security policy](SECURITY.md)

## Affiliation and license

Push Row is independent open-source software. It is not affiliated with or endorsed by Clay, LinkedIn, HubSpot, Salesforce, or Attio. Product names and trademarks belong to their respective owners.

Released under the [MIT License](LICENSE).
