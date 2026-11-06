// background.js - MV3 service worker for Key Vault data-plane calls.

// Entra app registration setup:
// - Register a public client / SPA-style app. Do not configure a client secret.
// - Add the redirect URI chrome.identity.getRedirectURL() returns: https://<extension-id>.chromiumapp.org/
//   Unpacked builds use the ID pinned by the "key" field in manifest.json. The Chrome Web Store
//   build has no "key" and gets the store-assigned ID, so it needs its own redirect URI.
// - Grant delegated Key Vault permissions and assign Key Vault data-plane RBAC to the signed-in user.
// - Replace CLIENT_ID below with the app registration's Application (client) ID.
const CLIENT_ID = "3cf88cbe-59ac-40ec-ae35-27eea2dcf2d3";
const TENANT_ID = "organizations";
const KEY_VAULT_SCOPE = "https://vault.azure.net/.default";

// Key Vault only accepts tokens issued by the tenant that owns the vault, so the
// authority cannot be a single constant. Vaults in other tenants answer the first
// call with 401 plus a WWW-Authenticate challenge naming their tenant; that tenant
// is then used as the authority and remembered per vault.
const TENANT_GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHALLENGE_AUTHORITY_HOSTS = new Set([
    "login.microsoftonline.com",
    "login.windows.net",
    "sts.windows.net",
    "login.microsoftonline.us",
    "login.partner.microsoftonline.cn"
]);

const KEY_VAULT_API_VERSION = "7.4";
const FETCH_TIMEOUT_MS = 15000;
const KEY_VAULT_SECRET_LIST_MAX_RESULTS = 25;
const MAX_SECRET_LIST_PAGES = 400;
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60000;
const OAUTH_SCOPES = `openid profile offline_access ${KEY_VAULT_SCOPE}`;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const AUTH_STORAGE_KEYS = [
    "kvAuthRefreshToken",
    "kvAuthExpiresAt",
    "kvAuthAccount",
    "kvAuthTenantId"
];
const VAULT_TENANT_STORAGE_KEY = "kvVaultTenantMap";
const PENDING_TENANT_STORAGE_KEY = "kvPendingTenantId";
const PENDING_TENANT_REASON_STORAGE_KEY = "kvPendingTenantReason";
const PENDING_TENANT_AADSTS_STORAGE_KEY = "kvPendingTenantAadsts";
const PENDING_TENANT_STORAGE_KEYS = [
    PENDING_TENANT_STORAGE_KEY,
    PENDING_TENANT_REASON_STORAGE_KEY,
    PENDING_TENANT_AADSTS_STORAGE_KEY
];
// Tokens stored by earlier versions; only ever deleted, never read.
const LEGACY_AUTH_STORAGE_KEYS = ["kvToken"];
const LEGACY_SESSION_STORAGE_KEYS = ["kvSessionToken"];

// Entra errors that come from the app registration or the tenant's policy rather than
// from the user's session; signing in again cannot clear them, so the code must be shown.
const AADSTS_HINTS = {
    50020: "Account is not a member or guest of this tenant",
    50105: "Account is not assigned to this app in this tenant",
    50194: "App registration is single-tenant",
    53000: "Blocked by Conditional Access (device not compliant)",
    53003: "Blocked by Conditional Access",
    65001: "App has no consent in this tenant",
    90094: "Admin consent required in this tenant",
    90095: "Admin approval required in this tenant",
    700016: "App is not registered or consented in this tenant",
    7000119: "App registration does not allow this tenant"
};

// Access tokens stay in memory only; the refresh token is the sole persisted credential.
const accessTokenCache = new Map();
const pendingAccessTokenRequests = new Map();
let vaultTenantMap = null;

function isPortalContentScript(sender) {
    return sender.id === chrome.runtime.id
        && Boolean(sender.tab)
        && typeof sender.url === "string"
        && sender.url.startsWith("https://portal.azure.com/");
}

chrome.runtime.onInstalled.addListener(() => {
    Promise.all([
        storageRemove(LEGACY_AUTH_STORAGE_KEYS),
        sessionStorageRemove(LEGACY_SESSION_STORAGE_KEYS)
    ]).catch((error) => {
        console.warn("[KV Ext] Legacy token cleanup failed:", error);
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || typeof request.action !== "string") {
        return false;
    }

    if (request.action === "fetchSecret") {
        if (!isPortalContentScript(sender)) {
            sendResponse({ error: "Unsupported sender" });
            return false;
        }

        handleAsyncMessage(handleFetchSecret(request), sendResponse);
        return true;
    }

    if (request.action === "setSecret") {
        if (!isPortalContentScript(sender)) {
            sendResponse({ error: "Unsupported sender" });
            return false;
        }

        handleAsyncMessage(handleSetSecret(request), sendResponse);
        return true;
    }

    if (request.action === "listSecrets") {
        if (!isPortalContentScript(sender)) {
            sendResponse({ error: "Unsupported sender" });
            return false;
        }

        handleAsyncMessage(handleListSecrets(request), sendResponse);
        return true;
    }

    if (request.action === "signIn") {
        handleAsyncMessage(handleSignIn(request.tenantId), sendResponse);
        return true;
    }

    if (request.action === "signOut") {
        handleAsyncMessage(handleSignOut(), sendResponse);
        return true;
    }

    if (request.action === "getAuthStatus") {
        handleAsyncMessage(getAuthStatus(), sendResponse);
        return true;
    }

    return false;
});

function handleAsyncMessage(promise, sendResponse) {
    promise
        .then(sendResponse)
        .catch((error) => {
            console.error("[KV Ext] Background message error:", error);
            sendResponse({ error: error.message || "Unexpected background error" });
        });
}

class AuthRequiredError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthRequiredError";
    }
}

class OAuthTokenError extends Error {
    constructor(message, code, aadstsCode = 0) {
        super(message);
        this.name = "OAuthTokenError";
        this.code = code;
        this.aadstsCode = aadstsCode;
    }
}

function parseAadstsCode(body) {
    const listed = Array.isArray(body?.error_codes) ? Number(body.error_codes[0]) : 0;
    if (listed) {
        return listed;
    }

    const match = /AADSTS(\d+)/.exec(String(body?.error_description || ""));
    return match ? Number(match[1]) : 0;
}

function formatAadsts(aadstsCode) {
    return aadstsCode ? ` (AADSTS${aadstsCode})` : "";
}

function isClientConfigured() {
    return Boolean(CLIENT_ID && CLIENT_ID !== "TODO_ENTER_ENTRA_APP_CLIENT_ID");
}

function isTenantGuid(value) {
    return TENANT_GUID_PATTERN.test(String(value || ""));
}

function normalizeTenantKey(tenantId) {
    return isTenantGuid(tenantId) ? String(tenantId).toLowerCase() : TENANT_ID;
}

function getAuthorityUrl(path, tenantId = TENANT_ID) {
    return `https://login.microsoftonline.com/${encodeURIComponent(normalizeTenantKey(tenantId))}/oauth2/v2.0/${path}`;
}

// Key Vault answers a wrong-tenant token with:
// WWW-Authenticate: Bearer authorization="https://login.windows.net/<tenant>", resource="https://vault.azure.net"
function parseTenantFromChallenge(headerValue) {
    const match = /(?:authorization_uri|authorization)="([^"]+)"/i.exec(String(headerValue || ""));
    if (!match) {
        return "";
    }

    try {
        const authority = new URL(match[1]);
        if (authority.protocol !== "https:" || !CHALLENGE_AUTHORITY_HOSTS.has(authority.hostname.toLowerCase())) {
            return "";
        }

        const firstSegment = authority.pathname.split("/").filter(Boolean)[0] || "";
        return isTenantGuid(firstSegment) ? firstSegment.toLowerCase() : "";
    } catch {
        return "";
    }
}

async function getVaultTenantMap() {
    if (!vaultTenantMap) {
        const stored = await storageGet([VAULT_TENANT_STORAGE_KEY]);
        const raw = stored[VAULT_TENANT_STORAGE_KEY];
        vaultTenantMap = raw && typeof raw === "object" ? { ...raw } : {};
    }

    return vaultTenantMap;
}

async function getVaultTenant(vaultName) {
    const map = await getVaultTenantMap();
    const tenantId = map[vaultName.toLowerCase()];
    return isTenantGuid(tenantId) ? tenantId : "";
}

async function rememberVaultTenant(vaultName, tenantId) {
    if (!isTenantGuid(tenantId)) {
        return;
    }

    const map = await getVaultTenantMap();
    const key = vaultName.toLowerCase();

    if (map[key] === tenantId) {
        return;
    }

    map[key] = tenantId;
    await storageSet({ [VAULT_TENANT_STORAGE_KEY]: map });
}

function storageGet(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve(result || {});
        });
    });
}

function storageSet(values) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(values, () => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve();
        });
    });
}

function storageRemove(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve();
        });
    });
}

function sessionStorageGet(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.session.get(keys, (result) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve(result || {});
        });
    });
}

function sessionStorageSet(values) {
    return new Promise((resolve, reject) => {
        chrome.storage.session.set(values, () => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve();
        });
    });
}

function sessionStorageRemove(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.session.remove(keys, () => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve();
        });
    });
}

function getStoredAuth() {
    return storageGet(AUTH_STORAGE_KEYS).then((result) => ({
        refreshToken: result.kvAuthRefreshToken || "",
        expiresAt: Number(result.kvAuthExpiresAt) || 0,
        account: result.kvAuthAccount || null,
        tenantId: result.kvAuthTenantId || ""
    }));
}

function getCachedAccessToken(tenantId) {
    const entry = accessTokenCache.get(normalizeTenantKey(tenantId));

    if (!entry || Date.now() >= entry.expiresAt - ACCESS_TOKEN_EXPIRY_SKEW_MS) {
        return "";
    }

    return entry.accessToken;
}

function hasAnyUsableCachedAccessToken() {
    for (const tenantKey of accessTokenCache.keys()) {
        if (getCachedAccessToken(tenantKey)) {
            return true;
        }
    }

    return false;
}

function getLatestCachedExpiry() {
    let latest = 0;

    accessTokenCache.forEach((entry) => {
        if (entry.expiresAt > latest) {
            latest = entry.expiresAt;
        }
    });

    return latest;
}

// Held in session storage rather than a variable because the service worker unloads
// between the failed vault call and the moment the user opens the popup.
// The keys are written together and must be read together, or a concurrent failure for
// another tenant could pair one tenant's ID with the other tenant's reason.
async function getPendingSignIn() {
    const result = await sessionStorageGet(PENDING_TENANT_STORAGE_KEYS);
    const tenantId = result[PENDING_TENANT_STORAGE_KEY];

    if (!isTenantGuid(tenantId)) {
        return { tenantId: "", reason: "", aadstsCode: 0 };
    }

    return {
        tenantId,
        reason: String(result[PENDING_TENANT_REASON_STORAGE_KEY] || ""),
        aadstsCode: Number(result[PENDING_TENANT_AADSTS_STORAGE_KEY]) || 0
    };
}

// reason is set only when an admin fix is likely; aadstsCode is kept for every rejection.
function setPendingSignIn(tenantId, { reason = "", aadstsCode = 0 } = {}) {
    return isTenantGuid(tenantId)
        ? sessionStorageSet({
            [PENDING_TENANT_STORAGE_KEY]: tenantId,
            [PENDING_TENANT_REASON_STORAGE_KEY]: reason,
            [PENDING_TENANT_AADSTS_STORAGE_KEY]: aadstsCode
        })
        : sessionStorageRemove(PENDING_TENANT_STORAGE_KEYS);
}

function base64UrlEncodeBytes(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64UrlDecodeToString(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
}

function getRandomBase64Url(byteLength) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return base64UrlEncodeBytes(bytes);
}

function generatePkceVerifier() {
    return getRandomBase64Url(32);
}

async function generatePkceChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncodeBytes(new Uint8Array(digest));
}

function buildAuthorizeUrl({ redirectUri, codeChallenge, state, tenantId = TENANT_ID }) {
    const url = new URL(getAuthorityUrl("authorize", tenantId));
    url.search = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: OAUTH_SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        // Without this Entra silently reuses the existing session, which makes switching
        // to an account in another tenant look successful while returning the same token.
        prompt: "select_account"
    }).toString();

    return url.toString();
}

function launchWebAuthFlow(url) {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ interactive: true, url }, (redirectUrl) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                // Entra shows most tenant and consent errors on its own page and never
                // redirects, so Chrome only reports that the window was closed.
                const message = runtimeError.message || "";
                reject(new Error(/did not approve|closed/i.test(message)
                    ? "Sign-in window closed. If Microsoft showed an error, note its AADSTS code and Correlation ID."
                    : message || "Sign-in cancelled or failed"));
                return;
            }

            if (!redirectUrl) {
                reject(new Error("Sign-in did not return an authorization response"));
                return;
            }

            resolve(redirectUrl);
        });
    });
}

function parseAuthorizationCode(redirectResponseUrl, redirectUri, expectedState) {
    const redirectResponse = new URL(redirectResponseUrl);
    const expectedRedirect = new URL(redirectUri);

    if (
        redirectResponse.origin !== expectedRedirect.origin
        || redirectResponse.pathname !== expectedRedirect.pathname
    ) {
        throw new Error("Sign-in returned an unexpected redirect URI");
    }

    const error = redirectResponse.searchParams.get("error");
    if (error) {
        throw new Error(redirectResponse.searchParams.get("error_description") || error);
    }

    if (redirectResponse.searchParams.get("state") !== expectedState) {
        throw new Error("Sign-in state validation failed");
    }

    const code = redirectResponse.searchParams.get("code");
    if (!code) {
        throw new Error("Sign-in did not return an authorization code");
    }

    return code;
}

function parseJwtPayload(token) {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        return JSON.parse(base64UrlDecodeToString(payload));
    } catch {
        return null;
    }
}

function getAccountMetadata(tokenResponse) {
    const claims = parseJwtPayload(tokenResponse.id_token || "") || parseJwtPayload(tokenResponse.access_token || "") || {};

    return {
        name: claims.name || "",
        username: claims.preferred_username || claims.upn || "",
        tenantId: claims.tid || "",
        homeAccountId: claims.oid || claims.sub || ""
    };
}

function getFriendlyOAuthError(code, description, aadstsCode = 0) {
    if (AADSTS_HINTS[aadstsCode]) return `${AADSTS_HINTS[aadstsCode]}${formatAadsts(aadstsCode)}`;
    if (code === "invalid_client") return `Invalid extension client ID${formatAadsts(aadstsCode)}`;
    if (
        code === "invalid_grant"
        || code === "interaction_required"
        || code === "login_required"
        || code === "consent_required"
    ) {
        return `Sign in required${formatAadsts(aadstsCode)}`;
    }

    return description || code || "Token request failed";
}

async function readOAuthError(response) {
    try {
        const body = await response.json();
        const code = body?.error || "";
        const description = body?.error_description || body?.error_uri || "";
        const aadstsCode = parseAadstsCode(body);
        if (description) {
            console.warn("[KV Ext] Entra token error:", { code, description });
        }
        return new OAuthTokenError(getFriendlyOAuthError(code, description, aadstsCode), code, aadstsCode);
    } catch {
        return new OAuthTokenError(`Token request failed with HTTP ${response.status}`, "");
    }
}

async function requestToken(parameters, tenantId = TENANT_ID) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        ...parameters
    });

    try {
        const response = await fetchWithRetry(getAuthorityUrl("token", tenantId), {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json"
            },
            body: body.toString(),
            signal: controller.signal
        });

        if (!response.ok) {
            throw await readOAuthError(response);
        }

        return response.json();
    } catch (error) {
        if (error.name === "AbortError") {
            throw new OAuthTokenError("Token request timed out", "");
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function saveTokenResponse(tokenResponse, requestedTenantId = TENANT_ID, fallbackRefreshToken = "", fallbackAccount = null) {
    if (!tokenResponse.access_token) {
        throw new OAuthTokenError("Token response did not include an access token", "");
    }

    const expiresInMs = Math.max(Number(tokenResponse.expires_in) || 3600, 1) * 1000;
    const expiresAt = Date.now() + expiresInMs;
    const refreshToken = tokenResponse.refresh_token || fallbackRefreshToken || "";
    const parsedAccount = getAccountMetadata(tokenResponse);
    const account = parsedAccount.username || parsedAccount.name || parsedAccount.homeAccountId
        ? parsedAccount
        : fallbackAccount || parsedAccount;

    const entry = { accessToken: tokenResponse.access_token, expiresAt };
    accessTokenCache.set(normalizeTenantKey(requestedTenantId), entry);

    // Caching under the issuing tenant too means a later request that already knows the
    // vault's tenant can reuse a token first obtained through the "organizations" authority.
    const issuedTenantId = parseJwtPayload(tokenResponse.access_token)?.tid || "";
    if (isTenantGuid(issuedTenantId)) {
        accessTokenCache.set(issuedTenantId.toLowerCase(), entry);
    }

    await storageSet({
        kvAuthExpiresAt: expiresAt,
        kvAuthAccount: account,
        kvAuthTenantId: account.tenantId || ""
    });

    if (refreshToken) {
        await storageSet({ kvAuthRefreshToken: refreshToken });
    } else {
        await storageRemove(["kvAuthRefreshToken"]);
    }

    await storageRemove(LEGACY_AUTH_STORAGE_KEYS);

    return getAuthStatus();
}

async function exchangeAuthorizationCode(code, codeVerifier, redirectUri, tenantId = TENANT_ID) {
    const tokenResponse = await requestToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        scope: OAUTH_SCOPES
    }, tenantId);

    return saveTokenResponse(tokenResponse, tenantId);
}

// A refresh token is bound to the account rather than to one tenant, so redeeming it
// against another tenant's endpoint yields an access token that vault's tenant accepts,
// provided the app has a service principal there and the account has access.
async function refreshAccessToken(refreshToken, tenantId = TENANT_ID, fallbackAccount = null) {
    const tokenResponse = await requestToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: OAUTH_SCOPES
    }, tenantId);

    return saveTokenResponse(tokenResponse, tenantId, refreshToken, fallbackAccount);
}

async function handleSignIn(requestedTenantId = "") {
    if (!isClientConfigured()) {
        throw new AuthRequiredError("Extension auth not configured");
    }

    const tenantId = normalizeTenantKey(requestedTenantId);
    const redirectUri = chrome.identity.getRedirectURL();
    const codeVerifier = generatePkceVerifier();
    const codeChallenge = await generatePkceChallenge(codeVerifier);
    const state = getRandomBase64Url(16);
    const authorizeUrl = buildAuthorizeUrl({ redirectUri, codeChallenge, state, tenantId });
    const redirectResponseUrl = await launchWebAuthFlow(authorizeUrl);
    const code = parseAuthorizationCode(redirectResponseUrl, redirectUri, state);
    await exchangeAuthorizationCode(code, codeVerifier, redirectUri, tenantId);

    if ((await getPendingSignIn()).tenantId === tenantId) {
        await setPendingSignIn("");
    }

    return getAuthStatus();
}

async function clearOAuthAuth() {
    accessTokenCache.clear();
    pendingAccessTokenRequests.clear();

    await setPendingSignIn("");
    await storageRemove([...AUTH_STORAGE_KEYS, ...LEGACY_AUTH_STORAGE_KEYS]);
}

async function handleSignOut() {
    await clearOAuthAuth();
    return getAuthStatus();
}

async function getAuthStatus() {
    const storedAuth = await getStoredAuth();
    const hasCachedToken = hasAnyUsableCachedAccessToken();
    const pendingSignIn = await getPendingSignIn();

    return {
        configured: isClientConfigured(),
        signedIn: hasCachedToken || Boolean(storedAuth.refreshToken),
        clientId: CLIENT_ID,
        tenantId: TENANT_ID,
        signedInTenantId: storedAuth.tenantId,
        pendingTenantId: pendingSignIn.tenantId,
        pendingTenantReason: pendingSignIn.reason,
        pendingTenantAadstsCode: pendingSignIn.aadstsCode,
        account: storedAuth.account,
        expiresAt: hasCachedToken ? getLatestCachedExpiry() : storedAuth.expiresAt
    };
}

function isInteractionRequiredError(error) {
    return error instanceof OAuthTokenError
        && (
            error.code === "invalid_grant"
            || error.code === "interaction_required"
            || error.code === "login_required"
            || error.code === "consent_required"
        );
}

// Kept synchronous up to the map insert in getAccessToken so that a burst of parallel
// secret fetches on a cold worker shares one token request per tenant.
function createAccessTokenRequest(tenantKey) {
    return (async () => {
        const storedAuth = await getStoredAuth();

        if (!isClientConfigured() || !storedAuth.refreshToken) {
            return "";
        }

        try {
            await refreshAccessToken(storedAuth.refreshToken, tenantKey, storedAuth.account);
            return getCachedAccessToken(tenantKey);
        } catch (error) {
            // A code means Entra rejected the grant; an empty code means the request never
            // got that far, such as a timeout, which says nothing about consent.
            const isEntraRejection = error instanceof OAuthTokenError && Boolean(error.code);

            if (tenantKey !== TENANT_ID) {
                // Failing for one tenant tells us nothing about the tenant already signed
                // in, so record it for the popup rather than dropping the whole session.
                // Any rejection counts here: a tenant that has never consented to the app
                // can answer with codes well outside the usual interaction-required set.
                if (isEntraRejection) {
                    const reason = AADSTS_HINTS[error.aadstsCode] ? error.message : "";
                    await setPendingSignIn(tenantKey, { reason, aadstsCode: error.aadstsCode });
                    throw new AuthRequiredError(reason
                        ? `${reason} for tenant ${tenantKey}`
                        : `Sign in required for tenant ${tenantKey}${formatAadsts(error.aadstsCode)}`);
                }
            } else if (isInteractionRequiredError(error)) {
                await clearOAuthAuth();
                throw new AuthRequiredError(error.message || "Sign in required");
            }

            console.error("[KV Ext] Token refresh failed:", { tenant: tenantKey, error });
            throw new AuthRequiredError(error.message || "Sign in required");
        }
    })().finally(() => {
        pendingAccessTokenRequests.delete(tenantKey);
    });
}

async function getAccessToken(tenantId = TENANT_ID) {
    const tenantKey = normalizeTenantKey(tenantId);
    const cachedToken = getCachedAccessToken(tenantKey);
    if (cachedToken) {
        return cachedToken;
    }

    if (!pendingAccessTokenRequests.has(tenantKey)) {
        pendingAccessTokenRequests.set(tenantKey, createAccessTokenRequest(tenantKey));
    }

    const token = await pendingAccessTokenRequests.get(tenantKey);
    if (token) {
        return token;
    }

    if (!isClientConfigured()) {
        throw new AuthRequiredError("Extension auth not configured");
    }

    throw new AuthRequiredError("Sign in required");
}

function isValidVaultName(vaultName) {
    return /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/i.test(vaultName || "");
}

function isValidSecretName(secretName) {
    return /^[a-z0-9-]{1,127}$/i.test(secretName || "");
}

function isValidSecretVersion(version) {
    return /^[a-z0-9-]{1,64}$/i.test(version || "");
}

function isValidSecretListUrl(urlText, vaultName) {
    try {
        const url = new URL(urlText);
        return url.protocol === "https:"
            && url.hostname.toLowerCase() === `${vaultName}.vault.azure.net`.toLowerCase()
            && url.pathname === "/secrets"
            && url.searchParams.get("api-version") === KEY_VAULT_API_VERSION;
    } catch {
        return false;
    }
}

function getSecretNameFromId(id) {
    try {
        const url = new URL(id);
        const parts = url.pathname.split("/").filter(Boolean);
        const secretsIndex = parts.findIndex((part) => part.toLowerCase() === "secrets");
        return secretsIndex !== -1 ? parts[secretsIndex + 1] || "" : "";
    } catch {
        return "";
    }
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options) {
    let response;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(url, options);

        if (!TRANSIENT_STATUSES.has(response.status) || attempt === 2) {
            return response;
        }

        await wait(250 * (2 ** attempt));
    }

    return response;
}

async function readErrorMessage(response) {
    try {
        const body = await response.json();
        return body?.error?.message || body?.message || `HTTP ${response.status}`;
    } catch {
        return `HTTP ${response.status}`;
    }
}

// Key Vault sends its tenant challenge on every 401, so the challenge alone does not mean
// the tenant was wrong; only a token from a different tenant does.
function getFriendlyHttpError({ status, message, challengeTenantId = "", tokenTenantId = "" }) {
    if (status === 401) {
        if (challengeTenantId && challengeTenantId !== tokenTenantId) {
            return `Wrong tenant for this vault: token from ${tokenTenantId || "unknown tenant"}, vault needs ${challengeTenantId}`;
        }
        return `Token rejected: ${message}`;
    }
    if (status === 403) return "Access denied";
    if (status === 404) return "Secret not found";
    if (status === 429) return "Key Vault throttled the request";
    return message;
}

function describeVaultError(error, context) {
    if (error instanceof AuthRequiredError) {
        return error.message;
    }

    if (error?.name === "AbortError") {
        return "Key Vault request timed out";
    }

    if (error instanceof OAuthTokenError) {
        console.error("[KV Ext] Authentication failed:", error);
        return "Authentication failed";
    }

    console.error(`[KV Ext] ${context} error:`, error);
    return "Network error";
}

async function sendVaultRequest(url, options, accessToken) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetchWithRetry(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            },
            signal: controller.signal
        });

        if (response.ok) {
            return { ok: true, status: response.status, data: await response.json() };
        }

        return {
            ok: false,
            status: response.status,
            challengeTenantId: parseTenantFromChallenge(response.headers.get("WWW-Authenticate")),
            tokenTenantId: String(parseJwtPayload(accessToken)?.tid || "").toLowerCase(),
            message: await readErrorMessage(response)
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

// Calls the vault with a token for its tenant. A vault whose tenant is not yet known is
// tried with the default authority first; its 401 challenge names the tenant to use, which
// is then cached so later calls skip the extra round trip.
async function keyVaultRequest(vaultName, url, options = {}) {
    const knownTenantId = await getVaultTenant(vaultName);
    const attemptedTenantId = normalizeTenantKey(knownTenantId || TENANT_ID);
    const result = await sendVaultRequest(url, options, await getAccessToken(attemptedTenantId));

    if (result.ok || result.status !== 401) {
        return result;
    }

    const { challengeTenantId } = result;
    if (!challengeTenantId || challengeTenantId === attemptedTenantId) {
        return result;
    }

    console.info("[KV Ext] Vault requires another tenant:", { vaultName, tenantId: challengeTenantId });
    await rememberVaultTenant(vaultName, challengeTenantId);

    return sendVaultRequest(url, options, await getAccessToken(challengeTenantId));
}

async function handleListSecrets(request) {
    const vaultName = String(request.vaultName || "").trim();

    if (!isValidVaultName(vaultName)) {
        return { error: "Invalid vault name" };
    }

    const secrets = [];
    let nextUrl = `https://${vaultName}.vault.azure.net/secrets?api-version=${KEY_VAULT_API_VERSION}&maxresults=${KEY_VAULT_SECRET_LIST_MAX_RESULTS}`;

    for (let pageIndex = 0; nextUrl; pageIndex += 1) {
        if (pageIndex >= MAX_SECRET_LIST_PAGES) {
            return { error: "Secret list is too large" };
        }

        if (!isValidSecretListUrl(nextUrl, vaultName)) {
            return { error: "Invalid Key Vault continuation URL" };
        }

        try {
            const result = await keyVaultRequest(vaultName, nextUrl, { method: "GET" });

            if (!result.ok) {
                console.warn("[KV Ext] Secret list failed:", {
                    vaultName,
                    status: result.status,
                    challengeTenantId: result.challengeTenantId,
                    tokenTenantId: result.tokenTenantId,
                    message: result.message
                });
                return { error: getFriendlyHttpError(result) };
            }

            const items = Array.isArray(result.data.value) ? result.data.value : [];

            items.forEach((item) => {
                const secretName = getSecretNameFromId(item?.id || "");
                if (isValidSecretName(secretName)) {
                    secrets.push({
                        name: secretName,
                        id: item.id || "",
                        created: item.attributes?.created ?? null,
                        enabled: item.attributes?.enabled ?? null
                    });
                }
            });

            nextUrl = result.data.nextLink || "";
        } catch (error) {
            return { error: describeVaultError(error, "List") };
        }
    }

    return { secrets };
}

async function handleFetchSecret(request) {
    const vaultName = String(request.vaultName || "").trim();
    const secretName = String(request.secretName || "").trim();
    const secretVersion = String(request.version || "").trim();

    if (!isValidVaultName(vaultName)) {
        return { error: "Invalid vault name" };
    }

    if (!isValidSecretName(secretName)) {
        return { error: "Invalid secret name" };
    }

    if (secretVersion && !isValidSecretVersion(secretVersion)) {
        return { error: "Invalid secret version" };
    }

    const versionPath = secretVersion ? `/${encodeURIComponent(secretVersion)}` : "";
    const url = `https://${vaultName}.vault.azure.net/secrets/${encodeURIComponent(secretName)}${versionPath}?api-version=${KEY_VAULT_API_VERSION}`;

    try {
        const result = await keyVaultRequest(vaultName, url, { method: "GET" });

        if (!result.ok) {
            console.warn("[KV Ext] Secret fetch failed:", {
                vaultName,
                secretName,
                secretVersion,
                status: result.status,
                challengeTenantId: result.challengeTenantId,
                tokenTenantId: result.tokenTenantId,
                message: result.message
            });
            return { error: getFriendlyHttpError(result) };
        }

        return {
            value: result.data.value ?? "",
            created: result.data.attributes?.created ?? null
        };
    } catch (error) {
        return { error: describeVaultError(error, "Fetch") };
    }
}

async function handleSetSecret(request) {
    const vaultName = String(request.vaultName || "").trim();
    const secretName = String(request.secretName || "").trim();
    const hasValue = Object.prototype.hasOwnProperty.call(request, "value");
    const secretValue = hasValue ? String(request.value ?? "") : "";

    if (!isValidVaultName(vaultName)) {
        return { error: "Invalid vault name" };
    }

    if (!isValidSecretName(secretName)) {
        return { error: "Invalid secret name" };
    }

    if (!hasValue) {
        return { error: "Secret value is required" };
    }

    const url = `https://${vaultName}.vault.azure.net/secrets/${encodeURIComponent(secretName)}?api-version=${KEY_VAULT_API_VERSION}`;

    try {
        const result = await keyVaultRequest(vaultName, url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: secretValue })
        });

        if (!result.ok) {
            console.warn("[KV Ext] Secret set failed:", {
                vaultName,
                secretName,
                status: result.status,
                challengeTenantId: result.challengeTenantId,
                tokenTenantId: result.tokenTenantId,
                message: result.message
            });
            return { error: getFriendlyHttpError(result) };
        }

        return {
            value: result.data.value ?? "",
            id: result.data.id || "",
            created: result.data.attributes?.created ?? null
        };
    } catch (error) {
        return { error: describeVaultError(error, "Set") };
    }
}