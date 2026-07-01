// background.js - MV3 service worker for Key Vault data-plane calls.

// Entra app registration setup:
// - Register a public client / SPA-style app. Do not configure a client secret.
// - Add this exact redirect URI to the app: chrome.identity.getRedirectURL().
// - Grant delegated Key Vault permissions and assign Key Vault data-plane RBAC to the signed-in user.
// - Replace CLIENT_ID below with the app registration's Application (client) ID.
const CLIENT_ID = "3cf88cbe-59ac-40ec-ae35-27eea2dcf2d3";
const TENANT_ID = "organizations";
const KEY_VAULT_SCOPE = "https://vault.azure.net/.default";

const KEY_VAULT_API_VERSION = "7.4";
const FETCH_TIMEOUT_MS = 15000;
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60000;
const OAUTH_SCOPES = `openid profile offline_access ${KEY_VAULT_SCOPE}`;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const AUTH_STORAGE_KEYS = [
    "kvAuthRefreshToken",
    "kvAuthExpiresAt",
    "kvAuthAccount",
    "kvAuthTenantId"
];
const SESSION_TOKEN_STORAGE_KEY = "kvSessionToken";
const LEGACY_AUTH_STORAGE_KEYS = ["kvToken"];

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;
let pendingAccessTokenRequest = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || typeof request.action !== "string") {
        return false;
    }

    if (request.action === "fetchSecret") {
        if (sender.url && !sender.url.startsWith("https://portal.azure.com/")) {
            sendResponse({ error: "Unsupported sender" });
            return false;
        }

        handleAsyncMessage(handleFetchSecret(request), sendResponse);
        return true;
    }

    if (request.action === "setSecret") {
        if (sender.url && !sender.url.startsWith("https://portal.azure.com/")) {
            sendResponse({ error: "Unsupported sender" });
            return false;
        }

        handleAsyncMessage(handleSetSecret(request), sendResponse);
        return true;
    }

    if (request.action === "signIn") {
        handleAsyncMessage(handleSignIn(), sendResponse);
        return true;
    }

    if (request.action === "signOut") {
        handleAsyncMessage(handleSignOut(), sendResponse);
        return true;
    }

    if (request.action === "savePastedToken") {
        handleAsyncMessage(handleSavePastedToken(request.token), sendResponse);
        return true;
    }

    if (request.action === "clearPastedToken") {
        handleAsyncMessage(handleClearPastedToken(), sendResponse);
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
    constructor(message, code) {
        super(message);
        this.name = "OAuthTokenError";
        this.code = code;
    }
}

function isClientConfigured() {
    return Boolean(CLIENT_ID && CLIENT_ID !== "TODO_ENTER_ENTRA_APP_CLIENT_ID");
}

function getAuthorityUrl(path) {
    return `https://login.microsoftonline.com/${encodeURIComponent(TENANT_ID)}/oauth2/v2.0/${path}`;
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

function hasUsableCachedAccessToken() {
    return Boolean(
        cachedAccessToken
        && cachedAccessTokenExpiresAt
        && Date.now() < cachedAccessTokenExpiresAt - ACCESS_TOKEN_EXPIRY_SKEW_MS
    );
}

function normalizeAccessToken(token) {
    return String(token || "").trim().replace(/^Bearer\s+/i, "").trim();
}

async function getPastedToken() {
    const result = await sessionStorageGet([SESSION_TOKEN_STORAGE_KEY]);
    return normalizeAccessToken(result[SESSION_TOKEN_STORAGE_KEY]);
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

function buildAuthorizeUrl({ redirectUri, codeChallenge, state }) {
    const url = new URL(getAuthorityUrl("authorize"));
    url.search = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: OAUTH_SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
    }).toString();

    return url.toString();
}

function launchWebAuthFlow(url) {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ interactive: true, url }, (redirectUrl) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message || "Sign-in cancelled or failed"));
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

function getFriendlyOAuthError(code, description) {
    if (code === "invalid_client") return "Invalid extension client ID";
    if (
        code === "invalid_grant"
        || code === "interaction_required"
        || code === "login_required"
        || code === "consent_required"
    ) {
        return "Sign in required";
    }

    return description || code || "Token request failed";
}

async function readOAuthError(response) {
    try {
        const body = await response.json();
        const code = body?.error || "";
        const description = body?.error_description || body?.error_uri || "";
        return new OAuthTokenError(getFriendlyOAuthError(code, description), code);
    } catch {
        return new OAuthTokenError(`Token request failed with HTTP ${response.status}`, "");
    }
}

async function requestToken(parameters) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        ...parameters
    });

    try {
        const response = await fetchWithRetry(getAuthorityUrl("token"), {
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

async function saveTokenResponse(tokenResponse, fallbackRefreshToken = "", fallbackAccount = null) {
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

    cachedAccessToken = tokenResponse.access_token;
    cachedAccessTokenExpiresAt = expiresAt;

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

async function exchangeAuthorizationCode(code, codeVerifier, redirectUri) {
    const tokenResponse = await requestToken({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        scope: OAUTH_SCOPES
    });

    return saveTokenResponse(tokenResponse);
}

async function refreshAccessToken(refreshToken, fallbackAccount = null) {
    const tokenResponse = await requestToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: OAUTH_SCOPES
    });

    return saveTokenResponse(tokenResponse, refreshToken, fallbackAccount);
}

async function handleSignIn() {
    if (!isClientConfigured()) {
        throw new AuthRequiredError("Extension auth not configured");
    }

    const redirectUri = chrome.identity.getRedirectURL();
    const codeVerifier = generatePkceVerifier();
    const codeChallenge = await generatePkceChallenge(codeVerifier);
    const state = getRandomBase64Url(16);
    const authorizeUrl = buildAuthorizeUrl({ redirectUri, codeChallenge, state });
    const redirectResponseUrl = await launchWebAuthFlow(authorizeUrl);
    const code = parseAuthorizationCode(redirectResponseUrl, redirectUri, state);

    return exchangeAuthorizationCode(code, codeVerifier, redirectUri);
}

async function clearOAuthAuth() {
    cachedAccessToken = "";
    cachedAccessTokenExpiresAt = 0;
    pendingAccessTokenRequest = null;

    await storageRemove([...AUTH_STORAGE_KEYS, ...LEGACY_AUTH_STORAGE_KEYS]);
}

async function handleSignOut() {
    await clearOAuthAuth();
    await sessionStorageRemove([SESSION_TOKEN_STORAGE_KEY]);
    return getAuthStatus();
}

async function handleSavePastedToken(token) {
    const normalizedToken = normalizeAccessToken(token);
    if (!normalizedToken) {
        throw new AuthRequiredError("Paste a token first");
    }

    await sessionStorageSet({ [SESSION_TOKEN_STORAGE_KEY]: normalizedToken });
    await storageRemove(LEGACY_AUTH_STORAGE_KEYS);
    return getAuthStatus();
}

async function handleClearPastedToken() {
    await sessionStorageRemove([SESSION_TOKEN_STORAGE_KEY]);
    return getAuthStatus();
}

async function getAuthStatus() {
    const storedAuth = await getStoredAuth();
    const manualTokenActive = Boolean(await getPastedToken());
    const signedIn = hasUsableCachedAccessToken() || Boolean(storedAuth.refreshToken);

    return {
        configured: isClientConfigured(),
        signedIn,
        manualTokenActive,
        authenticated: signedIn || manualTokenActive,
        clientId: CLIENT_ID,
        tenantId: TENANT_ID,
        account: storedAuth.account,
        expiresAt: hasUsableCachedAccessToken() ? cachedAccessTokenExpiresAt : storedAuth.expiresAt
    };
}

async function getAccessToken() {
    if (hasUsableCachedAccessToken()) {
        return cachedAccessToken;
    }

    const storedAuth = await getStoredAuth();
    if (isClientConfigured() && storedAuth.refreshToken && !pendingAccessTokenRequest) {
        pendingAccessTokenRequest = (async () => {
            try {
                await refreshAccessToken(storedAuth.refreshToken, storedAuth.account);
                return cachedAccessToken;
            } catch (error) {
                if (
                    error instanceof OAuthTokenError
                    && (
                        error.code === "invalid_grant"
                        || error.code === "interaction_required"
                        || error.code === "login_required"
                        || error.code === "consent_required"
                    )
                ) {
                    await clearOAuthAuth();
                    throw new AuthRequiredError("Sign in required");
                }

                console.error("[KV Ext] Token refresh failed:", error);
                throw new AuthRequiredError(error.message || "Sign in required");
            }
        })().finally(() => {
            pendingAccessTokenRequest = null;
        });
    }

    if (pendingAccessTokenRequest) {
        try {
            return await pendingAccessTokenRequest;
        } catch (error) {
            if (!(error instanceof AuthRequiredError)) {
                throw error;
            }
        }
    }

    const pastedToken = await getPastedToken();
    if (pastedToken) {
        return pastedToken;
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

function getFriendlyHttpError(status, message) {
    if (status === 401) return "Token expired or invalid";
    if (status === 403) return "Access denied";
    if (status === 404) return "Secret not found";
    if (status === 429) return "Key Vault throttled the request";
    return message;
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

    let accessToken;
    try {
        accessToken = await getAccessToken();
    } catch (error) {
        if (error instanceof AuthRequiredError) {
            return { error: error.message };
        }

        console.error("[KV Ext] Authentication failed:", error);
        return { error: "Authentication failed" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const versionPath = secretVersion ? `/${encodeURIComponent(secretVersion)}` : "";
    const url = `https://${vaultName}.vault.azure.net/secrets/${encodeURIComponent(secretName)}${versionPath}?api-version=${KEY_VAULT_API_VERSION}`;

    try {
        const response = await fetchWithRetry(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            },
            signal: controller.signal
        });

        if (!response.ok) {
            const message = await readErrorMessage(response);
            console.warn("[KV Ext] Secret fetch failed:", {
                vaultName,
                secretName,
                secretVersion,
                status: response.status,
                message
            });
            return { error: getFriendlyHttpError(response.status, message) };
        }

        const data = await response.json();
        return {
            value: data.value ?? "",
            created: data.attributes?.created ?? null
        };
    } catch (error) {
        if (error.name === "AbortError") {
            return { error: "Key Vault request timed out" };
        }

        console.error("[KV Ext] Fetch error:", error);
        return { error: "Network error" };
    } finally {
        clearTimeout(timeoutId);
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

    let accessToken;
    try {
        accessToken = await getAccessToken();
    } catch (error) {
        if (error instanceof AuthRequiredError) {
            return { error: error.message };
        }

        console.error("[KV Ext] Authentication failed:", error);
        return { error: "Authentication failed" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url = `https://${vaultName}.vault.azure.net/secrets/${encodeURIComponent(secretName)}?api-version=${KEY_VAULT_API_VERSION}`;

    try {
        const response = await fetchWithRetry(url, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ value: secretValue }),
            signal: controller.signal
        });

        if (!response.ok) {
            const message = await readErrorMessage(response);
            console.warn("[KV Ext] Secret set failed:", {
                vaultName,
                secretName,
                status: response.status,
                message
            });
            return { error: getFriendlyHttpError(response.status, message) };
        }

        const data = await response.json();
        return {
            value: data.value ?? "",
            id: data.id || "",
            created: data.attributes?.created ?? null
        };
    } catch (error) {
        if (error.name === "AbortError") {
            return { error: "Key Vault request timed out" };
        }

        console.error("[KV Ext] Set error:", error);
        return { error: "Network error" };
    } finally {
        clearTimeout(timeoutId);
    }
}