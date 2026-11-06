# Publishing to the Chrome Web Store

The store build has no `key` field and no built-in app registration. Every user, including you, enters their own client ID and tenant on the settings page after installing. Nothing in the package is tied to one tenant.

## Build the package

```powershell
node .\scripts\package.mjs
```

See [Development](development.md#build-the-store-package) for what the ZIP contains. Bump `version` in `manifest.json` first. The store rejects a version it has already seen.

## First upload

1. Upload the ZIP in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) (`New item`).
2. Copy the item ID the dashboard shows. This is the store extension ID.
3. Fill in the listing using the checklist below and submit for review.
4. To use the store build against your own app registration, install it, open its settings page, copy the redirect URI (`https://<store-id>.chromiumapp.org/`), and add it under the registration's `Authentication`. Keep the existing URIs for other builds. Then follow [Installation](installation.md#4-enter-the-ids-in-settings).
5. Optional: copy the store public key into `manifest.json` so unpacked builds share the store ID (see [Extension ID](app-registration.md#extension-id)).

Each user needs a redirect URI for the store ID on whichever app registration they use. An organization that shares one registration adds the store URI once.

Admin consent links for other tenants work with any redirect URI registered on the app. See [Admin consent](app-registration.md#admin-consent).

## Store listing checklist

Single purpose:

> Shows, edits, and transfers Azure Key Vault secret values inside the Azure Portal Key Vault pages, using the signed-in user's own Azure permissions.

Permission justifications:

| Permission | Justification |
|---|---|
| `storage` | Stores the Microsoft sign-in refresh token, account name, a map of vault name to tenant ID so the user does not sign in on every visit, and the app registration client ID and tenant ID the user enters on the settings page. |
| `identity` | Runs Microsoft Entra sign-in (OAuth authorization code with PKCE) through `chrome.identity.launchWebAuthFlow`. |
| `https://portal.azure.com/*` | Adds the reveal, edit, create, search, export, and import controls to the Azure Portal Key Vault secrets pages, and lets the popup reload the active portal tab after sign-in. |
| `https://*.vault.azure.net/*` | Reads, lists, and writes secrets with the Azure Key Vault REST API for the vault the user has open. |
| `https://login.microsoftonline.com/*` | Exchanges the sign-in code and refresh token for Key Vault access tokens. |

Remote code: answer `No`. All scripts are in the package; the extension only calls Microsoft APIs for data.

Data usage disclosures (Privacy practices tab):

- Check `Personally identifiable information` (display name, username or UPN, Entra object ID, and tenant ID from the token).
- Check `Authentication information` (Microsoft refresh and access tokens; secret values can be credentials too).
- Check `Website content` (Key Vault secret names and values, and the Azure Portal page address and title).
- Leave the other categories unchecked.
- Certify all three: data is not sold or transferred outside the approved use cases, not used or transferred for purposes unrelated to the single purpose, and not used for credit or lending decisions.
- Data goes only to Microsoft (`login.microsoftonline.com`, `*.vault.azure.net`) and is never sent to the developer or third parties. Secret values stay in page memory and are written to disk only when the user exports a file.

Privacy policy: [`PRIVACY.md`](../PRIVACY.md). [`privacy.html`](privacy.html) is the same text as a standalone page for hosting. Fill in any `{{EFFECTIVE_DATE}}` and `{{CONTACT_EMAIL}}` placeholders in both, publish the HTML at a public URL, and put that URL in the `Privacy practices` tab. When a change affects what data the extension handles, stores, or sends, update both files and the disclosures above in the same change. Neither file goes into the store ZIP.

Listing assets:

- Store icon: 128x128 (`icons/icon128.png`).
- At least one screenshot, 1280x800 or 640x400. Suggested: secrets list with values revealed (use a test vault with fake values), editable current version with the save check, export/import panel, and the popup signed in.
- Small promo tile: 440x280. The dashboard asks for it before submission.
- Detailed description: state that the extension is not affiliated with or endorsed by Microsoft, that it only works with the user's existing Key Vault RBAC permissions, and that each user or organization supplies their own Microsoft Entra app registration (link to the installation steps).

Reviewer notes: reviewers cannot sign in to your tenant, and the extension does nothing until an app registration is entered. Explain that it needs a Microsoft Entra work account with Key Vault access plus a client ID and tenant ID on the settings page, and point to the screenshots. If it is only for your organization, consider `Unlisted` visibility (installable only by link). `Private` visibility needs a Google Workspace domain or trusted testers. Every visibility still goes through review.
