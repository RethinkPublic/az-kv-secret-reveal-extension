# Security and Permissions

This extension displays and edits secrets. Treat it as privileged tooling.

For what the extension collects and sends, see the [privacy policy](../PRIVACY.md).

## Access model

The extension cannot read, list, or update secrets by itself. Without a valid Microsoft Entra user session, it is non-operable.

Access depends on all of the following:

- an app registration entered on the settings page, and a valid Microsoft Entra identity signing in to it;
- Azure RBAC data-plane permissions on the watched Key Vault;
- network access from the browser environment to Azure Portal and the target Key Vault endpoint.

If the signed-in user cannot access a vault in Azure, the extension cannot access it either. It does not bypass Azure permissions.

## Safety notice

- Revealed secret values are visible in the page, screenshots, browser accessibility trees, and potentially screen-sharing sessions.
- Exported JSON files contain plaintext secret values. Store and delete them with the same care as any other secret backup.
- Any user who can use this extension with your browser profile may be able to reveal secrets that your Azure identity can access.
- Editing the current value creates a new Key Vault secret version. It does not modify historical versions.
- Importing an existing name creates a new active Key Vault secret version.
- Older versions are immutable in Azure Key Vault and are shown read-only by this extension.
- Use least privilege. Grant read/write permissions only to users who truly need them.
- Review your organization's policy before using browser extensions with production secrets.

## Azure permissions

The extension uses delegated user permissions. It cannot independently discover, list, read, or write Key Vault secrets without a signed-in user that Azure accepts.

For reveal-only usage, the user needs permission to read secret values, such as:

- `secrets/get`
- `secrets/list`

Export requires both `secrets/list` and `secrets/get`.

For creating secrets, editing current values, creating new versions, and importing secrets, the user also needs:

- `secrets/set`

Common built-in RBAC roles:

- `Key Vault Secrets User`: read secret contents.
- `Key Vault Secrets Officer`: manage secrets, including setting new values.

Use the narrowest role and scope that works. Prefer Key Vault-level or resource-group-level scope over subscription-level scope when possible.

The app registration itself only needs the delegated `Azure Key Vault` > `user_impersonation` permission. It has no client secret and no application permissions. See [App Registration and Settings](app-registration.md).

## Browser permissions

The manifest requests:

- `storage`: store sign-in state, the vault-to-tenant map, and the app registration settings.
- `identity`: run Microsoft sign-in through browser identity APIs.

Host permissions:

- `https://portal.azure.com/*`: inject UI into Azure Portal, and let the popup see that the active tab is the portal so it can reload it after auth changes.
- `https://*.vault.azure.net/*`: call Key Vault data-plane APIs.
- `https://login.microsoftonline.com/*`: request OAuth tokens.

## What is stored

The extension stores auth-related data and your app registration IDs, not secret values.

Settings:

- The client ID and tenant ID from the settings page are stored in `chrome.storage.local`. They are not secrets. Sign-out does not clear them; `Clear settings` does.

Sign-in:

- Refresh token and account metadata are stored in `chrome.storage.local`.
- Access tokens are cached in the background service worker memory.
- Tokens left in storage by earlier versions, including the removed pasted-token option, are deleted when the extension is installed or updated.

Secret values:

- Values are fetched from Key Vault and rendered into the Azure Portal DOM when revealed.
- Values are cached in memory by the content script to avoid repeated fetches during the page session.
- Exported values are written only to the user-downloaded JSON file.
- Imported values are read from the selected file and sent to Key Vault; they are not intentionally written to extension local storage.
- A secret's cached values are dropped when you leave its versions view, so new versions created there (inline or with the portal's `New Version` flow) show up in the list immediately.
- Values are not intentionally written to extension local storage.

## Security concerns

### Secret exposure

Once revealed, secret values are plain text in the page. They can be seen by:

- anyone looking at the screen;
- screen-sharing software;
- screenshots;
- browser accessibility tools;
- potentially other extensions with broad page access.

Keep values hidden unless needed.

### Export files

Export files are plaintext secret backups. Do not attach them to tickets, email them, commit them, or leave them in shared folders. Prefer short-lived local handling and secure deletion after use.

### Editing production secrets

Saving a changed value creates a new active version. Applications that read the latest version may start using it immediately.

Before editing production secrets:

- confirm the target vault and secret name;
- confirm the current value;
- confirm application rollout expectations;
- confirm rollback steps;
- verify audit logging is enabled.

### RBAC scope

Do not grant broad subscription-level write permissions just for convenience.

Use least privilege:

- read-only users should not have `secrets/set`;
- writers should be scoped to only the vaults they manage;
- review access regularly.

### Browser profile risk

OAuth refresh tokens live in browser extension storage. Protect the browser profile with normal endpoint controls.

Recommended:

- use a managed device;
- keep browser and OS updated;
- avoid shared profiles;
- sign out when done;
- remove the extension when no longer needed.

### App registration risk

Anyone who knows your client ID can start a sign-in against your app registration, but they still need an account that your tenant's consent and assignment rules allow. Turn on `Assignment required` on the enterprise application to limit who can sign in, and review `Enterprise applications` > `Sign-in logs` periodically.

## Recommended operational practices

- Use separate development/test/prod vaults.
- Keep production write access limited.
- Enable Key Vault diagnostic logs.
- Review `SecretGet` and `SecretSet` activity.
- Prefer named versions or deployment records in application change logs.
- Rotate secrets through normal operational processes.
- Remove stale secret versions according to your retention policy.

## Disclaimer

This extension is powerful because it uses your Azure identity to reveal and update secrets. Review the code, test in non-production vaults first, and make sure usage is allowed by your organization before using it with sensitive environments.
