# App Registration and Settings

The extension signs in with OAuth Authorization Code Flow with PKCE through `chrome.identity.launchWebAuthFlow`. It needs a Microsoft Entra app registration that you provide. The extension contains no client ID and no tenant, so it cannot sign in until you save both on the settings page.

For the step-by-step setup, see [Installation](installation.md). This page is the reference.

## Settings page

Open it from the popup's `Settings` button, or from `chrome://extensions` > the extension's `Details` > `Extension options`. A fresh install opens it automatically.

| Field | Required | Notes |
|---|---|---|
| `Redirect URI` | read-only | `chrome.identity.getRedirectURL()` for the running build. Add it to the app registration under `Authentication`. |
| `Application (client) ID` | yes | A GUID from the app registration's `Overview` page. |
| `Directory (tenant) ID` | yes | A tenant GUID, or `organizations`. See [Choosing the tenant](#choosing-the-tenant). |

Buttons:

- `Save` checks both values and stores them. If either value differs from what was stored, you are signed out. A refresh token only works for the app registration and authority that issued it. Sign in again from the popup. The vault-to-tenant list is kept.
- `Clear settings` removes both values and signs you out. The extension then behaves as on a fresh install.
- `Copy` puts the redirect URI on the clipboard.

Both values are stored in `chrome.storage.local` as `kvConfigClientId` and `kvConfigTenantId`. They are IDs, not secrets. Only the extension's own pages can read or change them. Sign-out does not clear them.

The popup shows the saved client ID as `App ID` under the account name, so you can confirm which registration is in use.

## Required app registration settings

| Setting | Value |
|---|---|
| Platform | `Single-page application` |
| Redirect URI | The `https://<extension-id>.chromiumapp.org/` value from the settings page, one per extension ID. It must end with `/`. |
| Client secret | None. Do not create one. |
| API permission | `Azure Key Vault` > delegated `user_impersonation` |
| Supported account types | Single tenant for one tenant. Multi-tenant to read vaults in several tenants. |

The extension requests this scope:

```js
const KEY_VAULT_SCOPE = "https://vault.azure.net/.default";
```

`.default` asks for the permissions you configured under `API permissions`, so `user_impersonation` must be added there.

## Choosing the tenant

The tenant value is the starting authority for sign-in.

| Value | Use when |
|---|---|
| A tenant GUID | The app registration is single tenant, or you want to sign in to exactly one tenant. |
| `organizations` | The app registration is multi-tenant and you want to sign in with any work or school account. |

`organizations` with a single-tenant registration fails with `AADSTS50194`. See [Troubleshooting](troubleshooting.md#tenant-rejected-the-extension-aadsts-codes).

The starting authority is only the first attempt for each vault. Vaults in other tenants are resolved as described below.

## Vaults in multiple tenants

Key Vault's data plane is tenant-bound. A vault only accepts an access token issued by the tenant that owns it, and rejects anything else with HTTP 401 regardless of your RBAC assignments. A single fixed authority therefore cannot serve vaults in two tenants.

The extension resolves the tenant per vault:

1. The first call to an unknown vault uses the starting authority from settings.
2. If the vault rejects that token, it replies with `WWW-Authenticate: Bearer authorization="https://login.windows.net/<tenant-id>"`, naming the tenant it requires.
3. The extension re-acquires a token from that tenant and retries the call once.
4. The vault-to-tenant mapping is cached in `chrome.storage.local` under `kvVaultTenantMap`, so later calls go straight to the right authority.

Access tokens are cached per tenant in memory. The refresh token is bound to your account rather than to one tenant, so switching tenants is usually silent and needs no extra sign-in.

To use a second tenant, the app registration must be multi-tenant (`Accounts in any organizational directory`) **and** have a service principal in that tenant. The service principal is created the first time someone consents to the app there.

Many tenants only allow user consent for apps from verified publishers. An app you register yourself is unverified, so signing in shows `Approval required` with a justification box instead of a consent button. Enter a justification and submit it. An administrator then approves it under `Microsoft Entra ID` > `Enterprise applications` > `Admin consent requests`. That single approval creates the service principal and the extension works from then on.

If a silent cross-tenant token cannot be obtained, the popup keeps its `Sign-in` button visible and explains which tenant is needed. Clicking it signs you in directly against that tenant. Use this path when each tenant has a separate account rather than one guest account.

## Admin consent

An administrator can consent for a whole tenant without waiting for per-user requests. The admin consent endpoint requires a `redirect_uri` that is already registered on the app registration, otherwise it fails with `AADSTS90097`:

```text
https://login.microsoftonline.com/<tenant-id>/v2.0/adminconsent
  ?client_id=<your-client-id>
  &scope=https://vault.azure.net/.default openid profile offline_access
  &redirect_uri=<a-redirect-uri-registered-on-the-app>
```

Join it into one line and URL-encode the `scope` value. The administrator must hold Global Administrator, Privileged Role Administrator, or Cloud Application Administrator in that tenant. A normal user or a guest cannot grant admin consent.

For the app's own tenant, the `Grant admin consent for <tenant>` button under `API permissions` does the same.

## Extension ID

The redirect URI depends on the extension ID. There are three cases:

| Build | ID | Source |
|---|---|---|
| Loaded unpacked from this repository, or a `.crx` signed with the repo key | `aobcnpejfheeceefeejkogdonmhndhcn` | `key` field in `manifest.json` (public key of `keys/azkvextension.pem`) |
| Loaded unpacked from the packaged ZIP | Derived by Chrome from the folder path | The packaged manifest has no `key` |
| Chrome Web Store | Assigned by the store on first upload | The store's own signing key |

Each distinct ID needs its own redirect URI on the app registration. The settings page always shows the one for the running build.

The store rejects a manifest with a `key` field, so `node scripts/package.mjs` removes it from the packaged copy. The repository manifest keeps `key` so unpacked installs keep a stable ID. Do not remove `key` from the repository manifest unless you replace it.

To give unpacked builds the store ID instead, so one redirect URI covers both:

1. In the Chrome Web Store Developer Dashboard, open the item, go to `Package`, and click `View public key`.
2. Copy the base64 text between the `BEGIN PUBLIC KEY` and `END PUBLIC KEY` lines and join it into one line.
3. Replace the `key` value in `manifest.json` with it. Unpacked builds now get the store ID. The package script still strips it.
4. Remove the `aobcnpejfheeceefeejkogdonmhndhcn` redirect URI once nobody uses the old unpacked or `.crx` build.

Changing the ID clears the extension's stored sign-in, settings, and vault-to-tenant map, because Chrome storage is per extension ID. Users enter their settings and sign in again once.

Keep `keys/azkvextension.pem` private and out of version control. It is the signing key for the `.crx`. Anyone with it can publish an update that Chrome accepts as this extension.

Verify the ID after loading:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Find this extension.
4. Confirm the ID matches the value you registered.
