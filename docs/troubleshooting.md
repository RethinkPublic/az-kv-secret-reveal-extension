# Troubleshooting

Find your symptom, then follow the checks. For setup steps, see [Installation](installation.md).

| Symptom | Section |
|---|---|
| Popup says to set the app registration | [App registration not set](#app-registration-not-set) |
| Settings will not save | [Settings will not save](#settings-will-not-save) |
| Signed out after saving settings | [Signed out after saving settings](#signed-out-after-saving-settings) |
| `Invalid extension client ID` | [Invalid extension client ID](#invalid-extension-client-id) |
| Popup says `Needs sign-in` | [Needs sign-in](#needs-sign-in) |
| `Wrong tenant for this vault` | [Wrong tenant for this vault](#wrong-tenant-for-this-vault) |
| An `AADSTS` code | [Tenant rejected the extension](#tenant-rejected-the-extension-aadsts-codes) |
| `Access denied` | [Access denied](#access-denied) |
| `Token rejected` | [Token rejected](#token-rejected) |
| Timeouts | [Key Vault request timed out](#key-vault-request-timed-out) |
| No `Show Key Vault Secret Values` button | [Button does not appear](#button-does-not-appear) |
| Import fails | [Import file rejected](#import-file-rejected) |
| Grid does not update after save | [Values do not refresh after save](#values-do-not-refresh-after-save) |

## App registration not set

The extension has no built-in client ID or tenant. Until both are saved, the popup shows `Set the app registration in Settings before signing in.` and a vault cell shows `[App registration not set. Open the extension settings]`.

1. Click the extension icon, then `Settings`.
2. Enter `Application (client) ID` and `Directory (tenant) ID`.
3. Click `Save`, then sign in from the popup.

You also land here after an update from a version that had a built-in client ID, or after `Clear settings`.

## Settings will not save

The settings page reports the problem under the form:

- `Application (client) ID is required` or `must be a GUID`: paste the value from the app registration's `Overview` page. It looks like `00000000-0000-0000-0000-000000000000`.
- `Directory (tenant) ID is required` or `must be a GUID or "organizations"`: enter a tenant GUID or the word `organizations`. Other words such as `common` are not accepted.
- `Could not load settings`: reload the extension in `chrome://extensions` and reopen the page.

## Signed out after saving settings

This is expected. A refresh token only works for the client ID and tenant that issued it, so saving different values (or clearing them) signs you out. Open the popup and click `Sign-in`. Saving the same values again does not sign you out.

## Invalid extension client ID

Check:

- the Entra app registration exists;
- the client ID in `Settings` (shown in the popup as `App ID`) matches the `Application (client) ID` on the registration;
- a redirect URI is registered for the ID of the build you run. The settings page shows the exact value. For repository builds the ID is `aobcnpejfheeceefeejkogdonmhndhcn`; Web Store and ZIP installs have their own (see [Extension ID](app-registration.md#extension-id));
- for unpacked builds from the repository, the `key` field in `manifest.json` is intact, so the loaded ID matches that redirect URI;
- the redirect URI ends with `/`.

## Needs sign-in

Open the popup and sign in.

If the popup says the app registration is not set, see [App registration not set](#app-registration-not-set).

## Wrong tenant for this vault

The vault rejected the token because it was issued by a different tenant. Sign-in succeeding elsewhere does not help: Key Vault validates the issuing tenant before it looks at your permissions, which is why this appears as 401 rather than `Access denied`.

Open the popup. It names the tenant the vault requires and keeps the `Sign-in` button available. Click it and complete sign-in against that tenant.

If sign-in ends on `Approval required`, that tenant restricts user consent and the app has no service principal there yet. Submit the approval request and have an administrator approve it, or have an administrator consent directly. See [Vaults in multiple tenants](app-registration.md#vaults-in-multiple-tenants) and [Admin consent](app-registration.md#admin-consent).

To confirm the mismatch, compare the tenant that owns the vault against the `token from` tenant in the error:

```bash
az keyvault show --name <vault-name> --query properties.tenantId -o tsv
```

The background service worker console also logs `[KV Ext] Vault requires another tenant:` with the tenant the vault asked for.

## Tenant rejected the extension (AADSTS codes)

Errors from Entra carry their `AADSTS` code, in the grid cell and in the popup. These codes come from the app registration or the tenant's policy, so signing in again does not clear them:

| Code | Meaning | Fix (admin) |
|---|---|---|
| `AADSTS7000119` | App registration's `Allow only certain tenants` list does not include this tenant | Add the tenant ID under app registration > `Authentication` > `Supported account types`, or allow all tenants |
| `AADSTS50194` | App registration is single-tenant | Set `Supported account types` to multiple Entra ID tenants, or enter that tenant's ID instead of `organizations` in `Settings` |
| `AADSTS700016` | App has no service principal in this tenant | Grant admin consent in this tenant |
| `AADSTS65001`, `AADSTS90094`, `AADSTS90095` | Consent missing; users may not consent themselves | Grant admin consent, or approve the pending admin consent request |
| `AADSTS50105` | `Assignment required` is on and the user is not assigned | Assign the user or group to the enterprise app |
| `AADSTS53000`, `AADSTS53003` | Blocked by Conditional Access | Adjust the policy or use a compliant device |
| `AADSTS50020` | The account is not a member or guest of this tenant | Sign in with an account from this tenant, or invite the account as a guest |

When Entra shows the error on its own page, the sign-in window does not return it to the extension. Copy the error code and the `Troubleshooting details` (Request ID, Correlation ID, Timestamp) before closing the window.

## Access denied

Your identity does not have the needed Key Vault data-plane permission.

For reveal:

- check `secrets/get`;
- check `secrets/list` for export and import preview;
- check vault firewall and network restrictions;
- check tenant/account selection.

For save or import:

- check `secrets/set`.

See [Azure permissions](security.md#azure-permissions) for the roles.

## Token rejected

The vault returned 401 for a token from its own tenant. The Key Vault message after `Token rejected:` gives the reason, such as an expired token. Sign in again.

## Key Vault request timed out

The extension times out network calls after 15 seconds. Retry after checking:

- network connectivity;
- vault firewall rules;
- private endpoint access;
- Azure service health.

## Button does not appear

Check:

- you are on `https://portal.azure.com`;
- you are on a Key Vault secrets page;
- the extension is loaded and enabled;
- the page was refreshed after installing or signing in.

Azure Portal DOM changes can break grid detection. If the portal layout changes, `content.js` may need updates.

## Import file rejected

Check:

- the file is valid JSON;
- `format` is `azkv-secret-export`;
- `version` is `1`;
- every secret has a valid Key Vault secret name and string `value`;
- secret names are not duplicated case-insensitively.

## Values do not refresh after save

The extension clears its in-memory cache after saving and schedules a grid refresh. If the Azure Portal grid does not update:

1. Refresh the Azure Portal tab.
2. Hide and show values again.
3. Reopen the secret versions page.
