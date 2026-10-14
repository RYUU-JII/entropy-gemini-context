# domains

Canonical home for product domain rules and domain-owned public APIs.

Do not place runtime entrypoints or low-level platform adapters here.

`settings/config/settingsCommandContract.js` canonically owns physical settings
keys, named runtime owner actions, runtime delivery semantics, sender/redaction
properties, and ACK field requirements. `settingsDashboardCommandContract.js`
derives channel key sets and queue policy from those key facts. Dashboard
clients, message policy, platform transport, canonical patch validation, and
ACK validation derive their wiring from these named contracts. Domain/business
services remain typed; the contracts must not become a broad untyped settings
API.
`settings/config/settingsCommandRequestBuilders.js` is the adjacent executable
request-normalization seam for the owner actions declared by that registry; it
does not own ACK, sender, retry, or canonical key metadata.
