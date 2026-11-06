# Azure Key Vault Secret Revealer

A Chromium extension that adds inline Azure Key Vault secret values to the Azure Portal secret grids.

It can:

- reveal secret values directly in the Azure Portal list and version views;
- load the full secret list automatically, without clicking `Load more` repeatedly;
- filter the secret list with a search box and sort it by clicking the `Name` header;
- show secret version creation dates in the versions view;
- edit the current value and create a new secret version;
- create a brand-new secret from a slide-down panel that replaces the portal's native new-secret button;
- export and import current secret values with a plain JSON file and an import preview;
- keep older secret versions read-only;
- sign in with your own Microsoft Entra app registration, set up on a settings page.

This project is intended for users who already have valid Azure RBAC access to the target Key Vault. It does not bypass Azure permissions.

> **Treat this as privileged tooling.** Revealed values are plain text in the page, and export files are plaintext. Read [Security](docs/security.md) before using it with production secrets.

## Quick start

The extension ships with no app registration. You need a Microsoft Entra app registration and its IDs before it can sign in.

1. Install the extension (Web Store, release ZIP, or from source).
2. Open the settings page and copy the redirect URI.
3. Create an app registration in Microsoft Entra ID with that redirect URI and the delegated `Azure Key Vault` > `user_impersonation` permission. Copy its client ID and tenant ID.
4. Enter both IDs on the settings page and save.
5. Click `Sign-in` in the popup.
6. Make sure you have a Key Vault role such as `Key Vault Secrets User`.
7. Open a Key Vault's `Secrets` page in Azure Portal and click `Show Key Vault Secret Values`.

Full instructions with every click: [Installation](docs/installation.md).

## Documentation

| Document | What is in it |
|---|---|
| [Installation](docs/installation.md) | Install the extension, create the app registration, enter the IDs, sign in, grant Key Vault access. |
| [App Registration and Settings](docs/app-registration.md) | The settings page, required app registration settings, tenants, admin consent, extension ID. |
| [Usage](docs/usage.md) | Reveal, search, sort, create, edit, export, and import secrets. |
| [Security and Permissions](docs/security.md) | Access model, safety notice, Azure roles, browser permissions, what is stored. |
| [Troubleshooting](docs/troubleshooting.md) | Sign-in, tenant, `AADSTS`, access, and import problems. |
| [Development](docs/development.md) | How it works, project files, local checks, building the package, known limitations. |
| [Publishing](docs/publishing.md) | Chrome Web Store upload and listing checklist. |
| [Privacy policy](PRIVACY.md) | What data the extension handles and where it goes. |

## Requirements

- Google Chrome 102 or later, Microsoft Edge, or another Chromium browser that supports Manifest V3.
- Access to `https://portal.azure.com`.
- Network access to the target Key Vault endpoint, including any firewall or private endpoint requirements.
- Azure Key Vault data-plane permissions for the signed-in Microsoft Entra user.
- A Microsoft Entra app registration for OAuth sign-in. See [Installation](docs/installation.md#3-create-the-app-registration).

## License

See [LICENSE](LICENSE).

## Disclaimer

This extension is powerful because it uses your Azure identity to reveal and update secrets. Review the code, test in non-production vaults first, and make sure usage is allowed by your organization before using it with sensitive environments. It is not made, endorsed, or supported by Microsoft.
