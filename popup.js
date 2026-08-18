const signInButton = document.getElementById("signInBtn");
const signOutButton = document.getElementById("signOutBtn");
const tokenInput = document.getElementById("tokenInput");
const saveTokenButton = document.getElementById("saveTokenBtn");
const clearTokenButton = document.getElementById("clearTokenBtn");
const status = document.getElementById("status");
const accountInfo = document.getElementById("accountInfo");
const configInfo = document.getElementById("configInfo");
const lede = document.getElementById("lede");

const DEFAULT_LEDE = lede.textContent;
const SIGNED_IN_LEDE = "Open a Key Vault in Azure Portal, then reveal secret values from the command bar.";

let currentAuthStatus = null;
let isBusy = false;

function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = isError ? "status status-error" : "status";
    status.style.display = "block";
}

function getRuntimeErrorMessage() {
    return chrome.runtime.lastError?.message || "";
}

function sendBackgroundMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            const runtimeError = getRuntimeErrorMessage();

            if (runtimeError) {
                reject(new Error(runtimeError));
                return;
            }

            if (response?.error) {
                reject(new Error(response.error));
                return;
            }

            resolve(response || {});
        });
    });
}

function updateButtonStates(authStatus = currentAuthStatus) {
    if (!authStatus) {
        signInButton.hidden = false;
        signInButton.disabled = true;
        signOutButton.disabled = true;
        saveTokenButton.disabled = true;
        clearTokenButton.disabled = true;
        return;
    }

    // A signed-in user still needs this button when a vault in another tenant is pending,
    // and a pasted token is not a sign-in, so neither case counts as signed in here.
    signInButton.hidden = authStatus.signedIn && !authStatus.pendingTenantId;
    signInButton.disabled = isBusy || !authStatus.configured;
    signOutButton.disabled = isBusy || !authStatus.authenticated;
    saveTokenButton.disabled = isBusy;
    clearTokenButton.disabled = isBusy || !authStatus.manualTokenActive;
}

function setBusy(nextBusy) {
    isBusy = nextBusy;
    updateButtonStates();
}

function renderAuthStatus(authStatus) {
    currentAuthStatus = authStatus;

    if (!authStatus) {
        updateButtonStates(authStatus);
        lede.textContent = DEFAULT_LEDE;
        accountInfo.textContent = "";
        configInfo.textContent = "";
        return;
    }

    const accountName = authStatus.account?.username || authStatus.account?.name || "";
    const pendingTenantId = authStatus.pendingTenantId || "";

    updateButtonStates(authStatus);
    accountInfo.textContent = accountName ? `Account: ${accountName}` : "";
    lede.textContent = signInButton.hidden ? SIGNED_IN_LEDE : DEFAULT_LEDE;

    if (pendingTenantId) {
        showStatus(`A vault you opened belongs to tenant ${pendingTenantId}. Sign in to that tenant to read its secrets.`, true);
    } else if (authStatus.signedIn && authStatus.manualTokenActive) {
        showStatus("Signed in. Temporary fallback token also saved.");
    } else if (authStatus.signedIn) {
        tokenInput.value = "";
        showStatus("Signed in.");
    } else if (authStatus.manualTokenActive) {
        showStatus("Using pasted token for this browser session.");
    } else if (!authStatus.configured) {
        showStatus("Configure CLIENT_ID in background.js before signing in.", true);
    } else {
        showStatus("Needs sign-in.", true);
    }
}

function reloadActiveAzurePortalTab(successMessage, fallbackMessage) {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const queryError = getRuntimeErrorMessage();
            if (queryError) {
                showStatus(`Auth updated, but tab lookup failed: ${queryError}`, true);
                resolve();
                return;
            }

            const activeTab = tabs[0];
            if (!activeTab?.id) {
                showStatus(fallbackMessage);
                resolve();
                return;
            }

            if (activeTab.url && !activeTab.url.startsWith("https://portal.azure.com/")) {
                showStatus(fallbackMessage);
                resolve();
                return;
            }

            chrome.tabs.reload(activeTab.id, () => {
                const reloadError = getRuntimeErrorMessage();
                if (reloadError) {
                    showStatus(`Auth updated, but reload failed: ${reloadError}`, true);
                    resolve();
                    return;
                }

                showStatus(successMessage);
                resolve();
            });
        });
    });
}

async function loadAuthStatus() {
    try {
        renderAuthStatus(await sendBackgroundMessage({ action: "getAuthStatus" }));
    } catch (error) {
        currentAuthStatus = null;
        updateButtonStates(null);
        showStatus(`Could not load auth status: ${error.message}`, true);
    }
}

signInButton.addEventListener("click", async () => {
    setBusy(true);
    showStatus("Opening Microsoft sign-in...");

    try {
        renderAuthStatus(await sendBackgroundMessage({
            action: "signIn",
            tenantId: currentAuthStatus?.pendingTenantId || ""
        }));
        await reloadActiveAzurePortalTab(
            "Signed in. Azure Portal refreshed.",
            "Signed in. Switch to Azure Portal and refresh."
        );
    } catch (error) {
        showStatus(error.message || "Sign-in failed.", true);
    } finally {
        setBusy(false);
    }
});

signOutButton.addEventListener("click", async () => {
    setBusy(true);
    showStatus("Signing out...");

    try {
        renderAuthStatus(await sendBackgroundMessage({ action: "signOut" }));
        await reloadActiveAzurePortalTab(
            "Signed out. Azure Portal refreshed.",
            "Signed out. Switch to Azure Portal and refresh."
        );
    } catch (error) {
        showStatus(error.message || "Sign-out failed.", true);
    } finally {
        setBusy(false);
    }
});

saveTokenButton.addEventListener("click", async () => {
    setBusy(true);
    showStatus("Saving temporary token...");

    try {
        renderAuthStatus(await sendBackgroundMessage({
            action: "savePastedToken",
            token: tokenInput.value
        }));
        tokenInput.value = "";
        await reloadActiveAzurePortalTab(
            "Temporary token saved. Azure Portal refreshed.",
            "Temporary token saved. Switch to Azure Portal and refresh."
        );
    } catch (error) {
        showStatus(error.message || "Could not save token.", true);
    } finally {
        setBusy(false);
    }
});

clearTokenButton.addEventListener("click", async () => {
    setBusy(true);
    showStatus("Clearing temporary token...");

    try {
        renderAuthStatus(await sendBackgroundMessage({ action: "clearPastedToken" }));
        tokenInput.value = "";
        await reloadActiveAzurePortalTab(
            "Temporary token cleared. Azure Portal refreshed.",
            "Temporary token cleared. Switch to Azure Portal and refresh."
        );
    } catch (error) {
        showStatus(error.message || "Could not clear token.", true);
    } finally {
        setBusy(false);
    }
});

loadAuthStatus();