# Usage Guide

This guide assumes the extension is installed, configured, and signed in. If not, start with [Installation](installation.md).

Everything below happens on a Key Vault's `Secrets` page in `https://portal.azure.com`.

## Reveal secret values

1. Open the Azure Portal.
2. Navigate to a Key Vault.
3. Open `Secrets`.
4. Click `Show Key Vault Secret Values` in the command bar.
5. Wait for values to load.

If a value cannot be fetched, the injected cell shows an error such as:

- `[Access denied]`
- `[Secret not found]`
- `[Token rejected: <Key Vault message>]`
- `[Wrong tenant for this vault: token from <tenant-id>, vault needs <tenant-id>]`
- `[Sign in required for tenant <tenant-id>]`
- `[App registration not set. Open the extension settings]`
- `[Key Vault request timed out]`

See [Troubleshooting](troubleshooting.md) for each one.

## Hide secret values

Click `Hide Key Vault Secret Values`.

This masks the injected values in the grid. It does not revoke Azure tokens or clear all browser memory. To fully stop access, sign out from the popup or close the browser session.

## Secret list view

On a secrets list page, the extension injects a `Value` column next to the secret name.

When hidden, values are masked.

When revealed, each secret value is fetched from Key Vault and shown in an input. If you edit the current value, a subtle green check button appears at the end of the input. Pressing that button saves the value as a new secret version.

The `Value` column has a resize handle in the header. Drag it to widen or shrink the column.

### Automatic full list loading

The Azure Portal loads large secret lists in pages and requires clicking `Load more` repeatedly. The extension clicks the portal's `Load more` control automatically until every secret is loaded, so the full list appears without user intervention.

The auto-loader is scoped to the current blade, throttles its clicks, and stops on its own if clicking no longer adds rows. It works on both the secrets list and a secret's versions view. While pages load, the extension pins the scroll position so the view does not jump toward the newly loaded rows.

### Search by secret name

A search box appears above the secrets list, aligned to the right. Typing filters the loaded rows to secrets whose name contains the text, case-insensitively. A counter next to the box shows how many secrets match (`N of M`), or the total number of loaded secrets when the box is empty.

Press `Escape` or use the input's clear button to reset the filter.

### Sort by secret name

Click the `Name` column header to sort the secrets list by name: first click sorts ascending, second descending, third restores the original portal order. An arrow in the header shows the current direction.

Sorting is client-side and reorders only the rows already loaded, so combined with automatic full list loading it covers the whole vault.

## Create a new secret

On the secrets list, the extension hides the portal's native `Generate/Import` command and puts a `Create secret` command in its place.

1. Open the `Secrets` list.
2. Click `Create secret` in the command bar.
3. Type the secret name and value in the slide-down panel.
4. Click `Create` or press `Enter`.

The panel shows `Creating...`, then `Created`, then closes and refreshes the list. Errors (invalid name, duplicate name, access denied) appear inline. Press `Escape` to close the panel without creating.

`Create` validates the name, warns if a loaded row already uses it (a plain create would silently add a new version), then creates the secret through the Key Vault data-plane API. Creating secrets requires `secrets/set` permission.

The native button is hidden, not removed. It comes back when the extension UI is removed from the page.

## Create a new secret version

1. Reveal values.
2. Edit the current value input.
3. A green check appears at the end of the input.
4. Click the green check.
5. The extension calls Key Vault to create a new version.

The control shows:

- `Saving...`
- `Saved`
- or an error message

## Secret versions view

On a single secret's versions page, the extension injects:

- `Value`
- `Created date`

The current version is editable. Older versions are read-only and include a tooltip explaining that older versions cannot be changed.

### Older versions

Older versions are read-only. Azure Key Vault does not allow editing the value of an existing secret version.

To restore or reuse an older value:

1. Copy the older value.
2. Edit the current version value.
3. Save it as a new version.

## Export secrets

1. Open the `Secrets` list.
2. Click `Export secrets` in the command bar.
3. Read the plaintext-file warning.
4. Wait for listing and value fetch progress to finish.
5. Store the downloaded JSON file securely.

`Export secrets` lists the active vault, fetches every current secret value, and downloads a plain JSON file only if every value is fetched successfully. It does not create a partial file when any secret fails. If any secret cannot be fetched, the extension reports the failed names and does not download a file.

Export requires `secrets/list` and `secrets/get`.

Export files use this shape:

```json
{
  "format": "azkv-secret-export",
  "version": 1,
  "sourceVault": "example-vault",
  "exportedAt": "2026-07-10T20:00:00.000Z",
  "secrets": [
    {
      "name": "example-secret",
      "value": "plaintext secret value"
    }
  ]
}
```

Export files are plaintext. See [Security](security.md#export-files).

## Import secrets

1. Open the destination vault's `Secrets` list.
2. Click `Import secrets` in the command bar.
3. Select an export JSON file.
4. Review the preview, including source vault, destination vault, new names, and existing names.
5. Select `Replace existing values` or `Skip existing secrets`.
6. Click `Import` to write the selected values.

The import validates the file schema, shows source and destination vault names, and summarizes how many imported names are new versus existing.

Replacing does not overwrite a historical version in place. Key Vault creates a new active version for each existing imported name. Skip mode imports only names that do not exist in the destination vault. Import errors are reported per secret, and the list is refreshed after the write attempt.

Import requires `secrets/set`, plus `secrets/list` for the preview.

## Sign in, sign out, and settings

Use the extension popup:

- `Sign-in` opens Microsoft sign-in. The active Azure Portal tab reloads afterwards.
- `Sign out` deletes the stored refresh token and reloads the active portal tab.
- `Settings` opens the [app registration settings](app-registration.md#settings-page).

If sign-in is not set up, the popup shows `Set the app registration in Settings before signing in.`
