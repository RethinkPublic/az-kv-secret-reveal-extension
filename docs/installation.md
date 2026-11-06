# Installation

The extension ships with no app registration. Before it can sign in, you need a Microsoft Entra app registration and its IDs entered in the extension's settings. This guide covers everything from installing the extension to revealing your first secret.

Time needed: about 15 minutes.

## Who does what

| Role | Tasks |
|---|---|
| Entra admin, or a user allowed to register apps | [Create the app registration](#3-create-the-app-registration) once. Share its client ID and tenant ID. Optionally grant admin consent for everyone. |
| Every user | [Install the extension](#1-install-the-extension), [enter the IDs](#4-enter-the-ids-in-settings), [sign in](#5-sign-in). |
| Key Vault owner | [Assign Key Vault roles](#6-give-users-access-to-the-key-vault) to each user or group. |

If your organization already has an app registration, skip step 3 and ask for its client ID and tenant ID. You still send them your redirect URI (step 2) so it can be added.

## Requirements

- Google Chrome 102 or later, Microsoft Edge, or another Chromium browser that supports Manifest V3.
- A Microsoft Entra work or school account that can sign in to `https://portal.azure.com`.
- Azure RBAC data-plane access to the Key Vault (see step 6).
- Network access from the browser to Azure Portal and the Key Vault endpoint, including any firewall or private endpoint rules.
- To create the app registration: permission to register applications in Entra ID (for example the `Application Developer` role), or an admin who will do it for you.

## 1. Install the extension

Pick one source.

### Option A: Chrome Web Store

If your organization lists the extension in the Chrome Web Store, open the listing and click `Add to Chrome`. The settings page opens on its own after install. Continue with [step 2](#2-copy-the-redirect-uri).

### Option B: Release ZIP

1. Get `az-kv-secret-revealer-<version>.zip`. Build it yourself with `node scripts/package.mjs` (see [Development](development.md#build-the-store-package)) or take it from your organization.
2. Unzip it into a folder you will keep, for example `C:\Tools\az-kv-secret-revealer`.
3. Open `chrome://extensions` (or `edge://extensions`).
4. Turn on `Developer mode`.
5. Click `Load unpacked` and select the unzipped folder.

The packaged manifest has no `key` field, so Chrome derives the extension ID from the folder path. If you move or re-create the folder, the ID changes, and so does the redirect URI. See [Extension ID](app-registration.md#extension-id).

### Option C: From source

1. Clone or download this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on `Developer mode`.
4. Click `Load unpacked` and select the repository folder.

The repository manifest pins the extension ID to `aobcnpejfheeceefeejkogdonmhndhcn` through its `key` field, so the redirect URI stays the same on every machine. Confirm the ID shown on the extension card matches.

### Pin the icon (optional)

Click the puzzle-piece icon in the toolbar and pin `Key Vault Secret Revealer`, so the popup is one click away.

## 2. Copy the redirect URI

1. Open the settings page. On a fresh install it opens by itself. Otherwise click the extension icon, then `Settings`.
2. Click `Copy` next to `Redirect URI`. It looks like `https://<extension-id>.chromiumapp.org/`.

Keep this value for step 3. Every distinct extension ID needs its own redirect URI on the app registration.

## 3. Create the app registration

Skip this step if you were given a client ID and tenant ID. Ask the person who owns the registration to add your redirect URI under `Authentication`.

1. Sign in to `https://portal.azure.com`.
2. Open `Microsoft Entra ID` > `App registrations` > `New registration`.
3. `Name`: for example `kv-secret-revealer`.
4. `Supported account types`:
   - `Accounts in this organizational directory only` if every vault is in one tenant.
   - `Accounts in any organizational directory` if you read vaults in more than one tenant. See [Vaults in multiple tenants](app-registration.md#vaults-in-multiple-tenants).
5. `Redirect URI`: choose the `Single-page application` platform and paste the redirect URI from step 2. Click `Register`.
6. On the `Overview` page, copy:
   - `Application (client) ID`
   - `Directory (tenant) ID`
7. Open `API permissions` > `Add a permission` > `Microsoft APIs` > `Azure Key Vault` > `Delegated permissions`. Tick `user_impersonation` and click `Add permissions`.
8. If your tenant needs it, click `Grant admin consent for <tenant>` on the same page. Without it, each user may see an approval prompt at first sign-in.
9. Do not create a client secret. The extension never uses one.

To use the extension from more than one install (for example a Web Store install and an unpacked install), add one redirect URI per extension ID. Open `Authentication` on the registration and add each URI under the same platform. Each URI ends with `/`.

## 4. Enter the IDs in settings

1. Open the extension's settings page.
2. `Application (client) ID`: paste the client ID from step 3.
3. `Directory (tenant) ID`: paste the tenant ID, or enter `organizations`.

   | Your app registration | Enter |
   |---|---|
   | Single tenant | That tenant's `Directory (tenant) ID` |
   | Multi-tenant | `organizations` (any work or school account), or one tenant's ID |

4. Click `Save`.

Both fields are required. There are no built-in values. The IDs are stored in your browser profile, not in the extension files, and an extension update keeps them.

## 5. Sign in

1. Click the extension icon.
2. Click `Sign-in`.
3. Complete the Microsoft sign-in window and accept the permission prompt.
4. The popup shows `Signed in.` and your account name. An open Azure Portal tab reloads.

If the window ends on `Approval required`, your tenant limits user consent. Ask an admin to approve the app: see [Admin consent](app-registration.md#admin-consent). For other sign-in errors, see [Troubleshooting](troubleshooting.md).

## 6. Give users access to the Key Vault

The extension acts as you. It cannot read a secret you cannot read in the portal.

For each user or group, open the Key Vault > `Access control (IAM)` > `Add` > `Add role assignment`:

| Task | Role |
|---|---|
| Reveal, list, and export secrets | `Key Vault Secrets User` |
| Also create, edit, and import secrets | `Key Vault Secrets Officer` |

Scope the role to the single vault where you can. Details are in [Security](security.md#azure-permissions).

## 7. Check that it works

1. In Azure Portal, open the Key Vault and go to `Secrets`.
2. Click `Show Key Vault Secret Values` in the command bar.
3. Values appear in the `Value` column.

A cell showing `[Access denied]` means the sign-in worked but your account lacks a Key Vault role (step 6). A cell showing a sign-in message means step 5 is not finished. See [Troubleshooting](troubleshooting.md).

Next: [Usage guide](usage.md).

## Update

- Chrome Web Store installs update on their own. Your settings and sign-in are kept.
- Unpacked installs: pull or download the new files into the same folder, open `chrome://extensions`, and click the reload icon on the extension. Refresh Azure Portal.

If the extension ID changes (a new folder path for a ZIP install, or a changed `key`), add the new redirect URI to the app registration. Sign-in data does not carry over to a different ID.

## Change or remove the app registration

- Change the IDs: open `Settings`, edit them, and click `Save`. Saving different values signs you out; sign in again.
- Clear the IDs: click `Clear settings`. The extension stops working until you enter new ones.
- Uninstall: remove the extension in `chrome://extensions`. Chrome deletes everything it stored. Delete the app registration in Entra ID if no one uses it any more.
