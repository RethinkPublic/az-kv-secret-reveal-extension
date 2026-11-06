# Privacy Policy: Azure Key Vault Secret Revealer

- **Effective date:** {{EFFECTIVE_DATE}}
- **Last updated:** {{EFFECTIVE_DATE}}
- **Publisher:** Rethink (RethinkFirst) ("Rethink", "we", "us")
- **Contact:** {{CONTACT_EMAIL}}

This policy explains what the Azure Key Vault Secret Revealer browser extension (the "extension") does with your data. The extension adds controls to the Azure Portal so you can show, edit, create, search, export, and import Azure Key Vault secrets with your own Azure permissions.

The extension is not made, endorsed, or supported by Microsoft.

## Summary

- The extension runs only in your browser. Rethink runs no server for it.
- It talks only to Microsoft: Microsoft Entra ID to sign you in, and the Azure Key Vaults you open.
- Rethink does not collect, receive, store, sell, or share any of your data.
- No analytics, tracking, ads, or remote code.
- Secret values stay in the memory of your Azure Portal tab. They are written to disk only when you export them to a file.
- Sign out in the extension popup to delete your sign-in data. Uninstall the extension to delete everything it stored.

## 1. Data the extension handles

All of this data stays on your device, except what the extension sends to Microsoft (see [section 3](#3-where-data-is-sent)).

| Data | Source | Why | Where it is kept | How long |
|---|---|---|---|---|
| Microsoft refresh token | Microsoft Entra ID, when you sign in | Get new access tokens without asking you to sign in again | `chrome.storage.local` (browser profile on your device) | Until you sign out or uninstall, or until Microsoft stops accepting it (the extension then deletes it) |
| Microsoft access tokens for Key Vault | Microsoft Entra ID | Call Key Vault as you | Memory of the extension's background service worker only. Never written to disk. | Until they expire (usually 60 to 90 minutes), the browser stops the service worker, or you sign out |
| Account details: display name, username (email or UPN), Entra object ID, tenant ID, token expiry time | Read from the tokens Microsoft returns | Show which account is signed in, and pick the right tenant | `chrome.storage.local` | Until you sign out or uninstall |
| Vault-to-tenant list: names of Key Vaults you opened and the tenant ID that owns each | Key Vault's reply when a vault belongs to another tenant | Send later requests to the right tenant without an extra round trip | `chrome.storage.local` | Until you uninstall. Sign-out does not clear it. It holds no tokens and no secret data. |
| Pending sign-in notice: a tenant ID, a short reason, and a Microsoft error code (AADSTS) | Microsoft's reply when a tenant rejects a token request | Tell you in the popup which tenant needs sign-in | `chrome.storage.session` (memory only, not written to disk) | Until you sign in to that tenant, sign out, or close the browser |
| Secret names and details: name, ID, created date, enabled flag | Key Vault and the Azure Portal page | Show the full list, search, sort, export, preview imports, and warn about duplicate names | Memory of the extension and the Azure Portal tab | Until you leave the page, or close or reload the tab |
| Secret values | Key Vault, when you reveal or export. You, when you type, create, or import a value. | Show, copy, edit, create, export, and import secrets | Memory of the Azure Portal tab and the page itself. Each value passes through the background service worker during its request. Never saved to extension storage. | Until you close or reload the tab. Saving a secret replaces its cached values, and leaving its versions view drops them. |
| Azure Portal page address and title | The open Azure Portal tab | Find which vault and secret are open, and notice page changes | Memory of the Azure Portal tab | While the tab is open |

Other points:

- **Your password.** The extension never sees it. Sign-in runs on Microsoft's own page in a window that Chrome opens. The extension only receives the result.
- **Account type.** The extension is built for Microsoft work or school accounts (Microsoft Entra ID).
- **Clipboard.** When you click a copy button, the secret value goes to your system clipboard. It stays there until you or another app replace it.
- **Diagnostic messages.** The extension writes short error messages to the browser's local developer console. They can include vault names, secret names, tenant IDs, HTTP status codes, and Microsoft error text. They never include tokens or secret values, and they are not sent anywhere.
- **Other websites.** The extension runs only on `https://portal.azure.com`. It does not read other sites or your browsing history.

## 2. How the data is used

The data is used only for the extension's single purpose: to show, edit, create, search, export, and import Azure Key Vault secrets in the Azure Portal, using your own Azure access.

It is not used for anything else. That includes advertising, profiling, analytics, market research, training AI models, or deciding creditworthiness or lending.

## 3. Where data is sent

The extension sends data only to Microsoft, directly from your browser, over HTTPS:

| Address | What is sent | Why |
|---|---|---|
| `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` (opened in Chrome's sign-in window) | The extension's app ID, the requested permissions, and one-time sign-in check values (PKCE and state) | You sign in to Microsoft |
| `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` | The extension's app ID, the one-time sign-in code and its PKCE check value, and your refresh token | Get access tokens for Key Vault, including for vaults in other tenants |
| `https://{vault-name}.vault.azure.net/secrets/...` (Key Vault REST API) | Your access token, secret names and versions, and new secret values when you save, create, or import | List, read, and write secrets |

The `{tenant}` part is `organizations` or the tenant ID that a vault names in its reply.

After sign-in, Microsoft sends you back to `https://<extension-id>.chromiumapp.org/`. Chrome handles that address inside the browser. It is not a server, and nothing is sent to it.

Microsoft handles this data under the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement) and your organization's agreements with Microsoft. Your organization may see your activity in its own logs, such as Microsoft Entra sign-in logs and Key Vault audit logs.

**Nothing is sent to Rethink or to anyone else.**

## 4. What we do not do

- We do not collect, receive, store, or have access to any data the extension handles.
- We do not sell, rent, or trade user data.
- We do not transfer user data to third parties. The only recipient is Microsoft, which your browser contacts directly because you chose to use its services.
- We do not use analytics, telemetry, crash reporting, cookies, tracking, or ads.
- We do not load or run remote code. All code ships inside the extension package, and its content security policy allows only the extension's own scripts.
- No person at Rethink reads your data, because we never receive it.

The Chrome Web Store shows publishers aggregate numbers, such as install counts and ratings. Google provides these under its own privacy policy. They do not come from the extension.

## 5. Export and import files

- **Export** saves a plain JSON file with secret names and values, through your browser's normal download. The values are **not encrypted**. After the download, the extension has no further access to the file. You are responsible for protecting it and deleting it when done.
- **Import** reads a JSON file you pick. The extension shows a preview, and after you confirm, sends the values only to the vault open in your tab. It does not keep the file or its contents.

## 6. Security

- All network traffic uses HTTPS.
- Sign-in uses OAuth 2.0 authorization code flow with PKCE. The extension has no client secret.
- Access tokens stay in memory only. The refresh token is the only credential saved to disk.
- The background service worker accepts secret requests only from the extension's own script on `https://portal.azure.com`. It checks vault names, secret names, and Key Vault paging links before it sends a request.
- The extension has no third-party libraries and no remote code.

Limits you should know:

- `chrome.storage.local` lives in your browser profile on your device. The extension does not add its own encryption to it. Protect your device with disk encryption and a screen lock, and do not share your browser profile.
- Revealed values are plain text on your screen. Anyone who can see your screen, a screen share, or a screenshot can read them.
- Anyone who can use your browser profile while you are signed in can use the extension with your Azure access. Sign out when you are done.

To report a security issue, write to {{CONTACT_EMAIL}}.

## 7. Your controls

- **Hide values:** click `Hide Key Vault Secret Values` in the Azure Portal command bar.
- **Clear secret values from memory:** close or reload the Azure Portal tab.
- **Sign out:** click `Sign out` in the extension popup. This deletes the refresh token, account details, cached access tokens, and any pending sign-in notice.
- **Remove everything:** uninstall the extension in `chrome://extensions`. Chrome deletes all of its stored data, including the vault-to-tenant list.
- **Delete export files** you no longer need.
- **Revoke access at Microsoft:** use "Sign out everywhere" in [My Account](https://myaccount.microsoft.com/). Your administrator can also revoke your sessions or remove the app's consent in Microsoft Entra ID under `Enterprise applications`.

Because Rethink holds no data about you, we have nothing to give you, correct, or delete. For data held by Microsoft or your organization, contact them.

## 8. Chrome Web Store User Data Policy

The use of information received by this extension, including information received from Google and Chrome APIs, adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use), including the Limited Use requirements. In particular:

- User data is used only to provide the single purpose described in [section 2](#2-how-the-data-is-used).
- User data is transferred only to Microsoft, and only as needed for that purpose.
- User data is never used or transferred for personalized, retargeted, or interest-based ads.
- User data is never sold, and never used or transferred to decide creditworthiness or for lending.
- No person reads user data.

## 9. Children

The extension is a tool for IT and cloud staff. It needs a Microsoft work or school account with Azure Key Vault access. It is not directed at children under 13, and we do not knowingly collect data from children. We collect no data from anyone.

## 10. Changes to this policy

If we change this policy, we will post the new version at the same address and update the "Last updated" date. If a future version handles data in a new way, such as new data types or new recipients, we will update this policy and the Chrome Web Store disclosures before that version is released, and ask for your consent in the extension where the Chrome Web Store policy requires it. Chrome also asks you to approve new permissions that an update adds.

## 11. Contact

Questions about this policy or the extension's data handling: Rethink (RethinkFirst), {{CONTACT_EMAIL}}.
