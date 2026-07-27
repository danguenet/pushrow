# Manual release check

Use only a Clay table owned by the tester. Never paste its URL or token into an issue, test fixture, screenshot, terminal log, or committed file.

1. Run `npm run build` and load `dist/` as an unpacked extension.
2. Open Push Row settings, save the user-owned Clay webhook, and approve the optional Clay permission.
3. Open one supported URL for each source and confirm the displayed normalized URL, object type, and record ID.
4. Make one manual send to the test table and confirm one row with exactly `source`, `url`, `record_id`, and `object_type`.
5. Confirm local activity shows the four-field request and result but contains no webhook URL, token, or response body.
6. Exercise a 401 or revoked permission and confirm Push Row records the result without retrying automatically.
7. Change activity retention, clear it, and turn it off; confirm each control takes effect immediately.
8. Delete all local data and confirm the destination, token, rules, activity, and Clay host permission are removed.
9. Remove any test rows in Clay. No credentials or resulting data belong in the repository.

## Publish a GitHub release

1. Confirm `package.json` and `CHANGELOG.md` contain the same release version.
2. Merge the release commit to `main` and confirm the `verify` and `e2e` CI jobs pass.
3. Create and push an annotated `v<version>` tag, such as `v0.1.0`.
4. Confirm the release workflow publishes `pushrow-<version>-chrome.zip` to the matching GitHub
   Release.
5. Download that asset, extract it, load it unpacked in Chrome, and repeat the smoke checks above.
