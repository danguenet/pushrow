# Manual release check

Use only a Clay table owned by the tester. Never paste its URL or token into an issue, test fixture, screenshot, terminal log, or committed file.

1. Run `npm run build` and load `.output/chrome-mv3` as an unpacked extension.
2. Open Posthook settings, save the user-owned Clay webhook, and approve the optional Clay permission.
3. Open one supported URL for each source and confirm the displayed normalized URL, object type, and record ID.
4. Make one manual send to the test table and confirm one row with exactly `source`, `url`, `record_id`, and `object_type`.
5. Exercise a 401 or revoked permission and confirm Posthook does not retry automatically.
6. Delete all local data and confirm the destination, token, rules, and Clay host permission are removed.
7. Remove any test rows in Clay. No credentials or resulting data belong in the repository.
