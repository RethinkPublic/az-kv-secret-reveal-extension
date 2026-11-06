const form = document.getElementById("configForm");
const redirectUriInput = document.getElementById("redirectUri");
const clientIdInput = document.getElementById("clientId");
const tenantIdInput = document.getElementById("tenantId");
const modeText = document.getElementById("mode");
const copyButton = document.getElementById("copyBtn");
const saveButton = document.getElementById("saveBtn");
const clearButton = document.getElementById("clearBtn");
const status = document.getElementById("status");

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANY_ORGANIZATION_TENANT = "organizations";

let currentConfig = null;
let isBusy = false;

function showStatus(message, isError = false) {
    status.textContent = message;
    status.className = isError ? "status status-error" : "status";
    status.style.display = "block";
}

function sendBackgroundMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            const runtimeError = chrome.runtime.lastError?.message;

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

function setBusy(nextBusy) {
    isBusy = nextBusy;
    updateButtonStates();
}

function updateButtonStates() {
    saveButton.disabled = isBusy || !currentConfig;
    clearButton.disabled = isBusy || !currentConfig || !currentConfig.configured;
    copyButton.disabled = !currentConfig;
}

function render(config) {
    currentConfig = config;
    redirectUriInput.value = config.redirectUri;
    clientIdInput.value = config.clientId;
    tenantIdInput.value = config.tenantId;
    modeText.textContent = config.configured
        ? "App registration saved."
        : "No app registration set. Enter both values to enable sign-in.";
    clearInvalid();
    updateButtonStates();
}

function clearInvalid() {
    clientIdInput.removeAttribute("aria-invalid");
    tenantIdInput.removeAttribute("aria-invalid");
}

function markInvalid(input) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
}

// The background worker validates again; this only gives faster feedback on typos.
function validateFields() {
    clearInvalid();

    const clientId = clientIdInput.value.trim();
    if (!clientId) {
        markInvalid(clientIdInput);
        return "Application (client) ID is required";
    }

    if (!GUID_PATTERN.test(clientId)) {
        markInvalid(clientIdInput);
        return "Application (client) ID must be a GUID, like 00000000-0000-0000-0000-000000000000";
    }

    const tenantId = tenantIdInput.value.trim();
    if (!tenantId) {
        markInvalid(tenantIdInput);
        return `Directory (tenant) ID is required: a tenant GUID or "${ANY_ORGANIZATION_TENANT}"`;
    }

    if (tenantId.toLowerCase() !== ANY_ORGANIZATION_TENANT && !GUID_PATTERN.test(tenantId)) {
        markInvalid(tenantIdInput);
        return `Directory (tenant) ID must be a GUID or "${ANY_ORGANIZATION_TENANT}"`;
    }

    return "";
}

async function submitConfig(message, successMessage) {
    setBusy(true);
    showStatus("Saving...");

    try {
        const config = await sendBackgroundMessage(message);
        render(config);
        showStatus(config.changed
            ? `${successMessage} You were signed out.${config.configured ? " Open the extension popup and sign in." : ""}`
            : "Saved. Nothing changed.");
    } catch (error) {
        showStatus(error.message || "Could not save settings.", true);
    } finally {
        setBusy(false);
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (isBusy || !currentConfig) {
        return;
    }

    const validationError = validateFields();
    if (validationError) {
        showStatus(validationError, true);
        return;
    }

    submitConfig({
        action: "saveConfig",
        clientId: clientIdInput.value,
        tenantId: tenantIdInput.value
    }, "Saved.");
});

clearButton.addEventListener("click", () => {
    if (!isBusy && currentConfig?.configured) {
        submitConfig({ action: "clearConfig" }, "Cleared.");
    }
});

copyButton.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(redirectUriInput.value);
        showStatus("Redirect URI copied.");
    } catch {
        redirectUriInput.select();
        showStatus("Could not copy. Select the redirect URI and copy it manually.", true);
    }
});

[clientIdInput, tenantIdInput].forEach((input) => {
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
});

async function loadConfig() {
    updateButtonStates();

    try {
        render(await sendBackgroundMessage({ action: "getConfig" }));
    } catch (error) {
        showStatus(`Could not load settings: ${error.message}`, true);
    }
}

loadConfig();
