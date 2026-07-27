# Push Row privacy policy

Effective: July 15, 2026

Push Row is a local-only Chrome extension. It has no Push Row-operated server, account system, analytics, advertising, or telemetry.

## Data handled

Push Row stores the destinations, optional authentication header values, routing rules, and bounded activity settings you create in persistent `chrome.storage.local` on your device. Chrome extension storage is restricted to trusted Push Row contexts, but it is not encrypted at rest.

When you click Send, Push Row derives `source`, `url`, `record_id`, and `object_type` from the active tab URL and sends those four fields to the Clay webhook you selected. An optional configured authentication header is sent with that request. Clay's handling of a request is governed by Clay's own terms and privacy practices.

By default, Push Row keeps the latest 10 send attempts locally. Each entry contains its time, destination ID and name, the four-field request, and either the HTTP status or a local error code. It never stores the destination webhook URL, authentication value, or response body in activity. You can retain 1–100 entries or set retention to 0 to turn activity off.

Push Row does not collect page content, cookies, browsing history, analytics, telemetry, or diagnostic response bodies. It does not sell or share data for advertising or analytics.

## Control and deletion

You can edit or delete individual destinations and rules, clear activity independently, or turn activity off. “Delete all local data” removes all Push Row settings, tokens, and activity and revokes Push Row's optional Clay host permission. Uninstalling the extension also removes its local extension storage under Chrome's normal behavior.

## Permissions

Push Row uses `activeTab` to read the current page URL only after you invoke the toolbar action, `storage` for local settings, and optional access to `https://api.clay.com/*` solely to send the request you initiate.

## Changes and contact

Material policy changes will be published in this repository and with the extension listing. For privacy questions, open a repository issue that contains no secrets or personal data. For security concerns, follow [SECURITY.md](SECURITY.md).
