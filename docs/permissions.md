# Permission rationale

| Permission               | When used                                | Why it is needed                                                                                                                   |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`              | After the user clicks the toolbar action | Reads only the active page URL so Push Row can recognize the record.                                                               |
| `storage`                | When local data loads or changes         | Keeps destinations, optional tokens, rules, and bounded activity locally. Sync storage is not used.                                |
| `https://api.clay.com/*` | Requested when a destination is saved    | Allows the background worker to make the user-initiated cross-origin webhook POST. This host permission is optional and revocable. |

Push Row does not request `tabs`, `scripting`, content-script matches, CRM or LinkedIn host access, cookies, clipboard, notifications, or `<all_urls>`.
