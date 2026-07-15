# Posthook privacy policy

Effective: July 14, 2026

Posthook is a local-only Chrome extension. It has no Posthook-operated server, account system, analytics, advertising, or telemetry.

## Data handled

Posthook stores the destinations, optional authentication header values, and routing rules you create in persistent `chrome.storage.local` on your device. Chrome extension storage is restricted to trusted Posthook contexts, but it is not encrypted at rest.

When you click Send, Posthook derives `source`, `url`, `record_id`, and `object_type` from the active tab URL and sends those four fields to the Clay webhook you selected. An optional configured authentication header is sent with that request. Clay's handling of a request is governed by Clay's own terms and privacy practices.

Posthook does not collect page content, cookies, browsing history, send history, or diagnostic response bodies. It does not sell or share data for advertising or analytics.

## Control and deletion

You can edit or delete individual destinations and rules. “Delete all local data” removes all Posthook settings and tokens and revokes Posthook's optional Clay host permission. Uninstalling the extension also removes its local extension storage under Chrome's normal behavior.

## Permissions

Posthook uses `activeTab` to read the current page URL only after you invoke the toolbar action, `storage` for local settings, and optional access to `https://api.clay.com/*` solely to send the request you initiate.

## Changes and contact

Material policy changes will be published in this repository and with the extension listing. For privacy questions, open a repository issue that contains no secrets or personal data. For security concerns, follow [SECURITY.md](SECURITY.md).
