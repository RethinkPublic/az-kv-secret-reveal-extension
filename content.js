// content.js - Azure Portal DOM manipulation only.

const TOGGLE_ID = "kv-secret-toggler";
const COLUMN_CLASS = "kv-secret-value-cell";
const HEADER_CLASS = "kv-secret-value-header";
const COL_CLASS = "kv-secret-value-col";
const CREATED_DATE_COLUMN_CLASS = "kv-secret-created-date-cell";
const CREATED_DATE_HEADER_CLASS = "kv-secret-created-date-header";
const CREATED_DATE_COL_CLASS = "kv-secret-created-date-col";
const RESIZE_HANDLE_CLASS = "kv-secret-value-resize-handle";
const DEFAULT_SECRET_VALUE_WIDTH_PX = 520;
const CREATED_DATE_WIDTH_PX = 220;
const MIN_SECRET_VALUE_WIDTH_PX = 160;
const MAX_SECRET_VALUE_WIDTH_PX = 900;
const MASKED_VALUE = "****************************************";
const SHOW_SECRETS_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-fill" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0"/>
  <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7"/>
</svg>`;
const HIDE_SECRETS_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash-fill" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7 7 0 0 0 2.79-.588M5.21 3.088A7 7 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474z"/>
  <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12z"/>
</svg>`;
const SAVE_SECRET_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path d="M13.485 1.929a.75.75 0 0 1 .086 1.056l-7.25 8.5a.75.75 0 0 1-1.104.04l-3.75-3.75a.75.75 0 1 1 1.06-1.06l3.177 3.176 6.725-7.876a.75.75 0 0 1 1.056-.086z"/>
</svg>`;
const COPY_VALUE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM4 5H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2H6a2 2 0 0 1-2-2V5z"/>
</svg>`;
const CREATE_SECRET_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
</svg>`;
const EXPORT_SECRETS_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path d="M8 1a.5.5 0 0 1 .5.5v7.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 9.293V1.5A.5.5 0 0 1 8 1"/>
  <path d="M2.5 11a.5.5 0 0 1 .5.5V13h10v-1.5a.5.5 0 0 1 1 0V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1.5a.5.5 0 0 1 .5-.5"/>
</svg>`;
const IMPORT_SECRETS_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true" role="presentation" focusable="false">
  <path d="M8 15a.5.5 0 0 1-.5-.5V6.707L5.354 8.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 6.707V14.5A.5.5 0 0 1 8 15"/>
  <path d="M2.5 5a.5.5 0 0 0 .5-.5V3h10v1.5a.5.5 0 0 0 1 0V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1.5a.5.5 0 0 0 .5.5"/>
</svg>`;
const VALUE_COLUMN = {
    label: "Value",
    headerClass: HEADER_CLASS,
    cellClass: COLUMN_CLASS,
    colClass: COL_CLASS,
    contentStyle: "font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
    resizable: true
};
const CREATED_DATE_COLUMN = {
    label: "Created date",
    headerClass: CREATED_DATE_HEADER_CLASS,
    cellClass: CREATED_DATE_COLUMN_CLASS,
    colClass: CREATED_DATE_COL_CLASS,
    contentStyle: "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
    resizable: false
};
const SEARCH_BAR_ID = "kv-secret-search-bar";
const SEARCH_INPUT_ID = "kv-secret-search-input";
const SEARCH_COUNT_CLASS = "kv-secret-search-count";
const CREATE_SECRET_BUTTON_ID = "kv-create-secret-button";
const CREATE_SECRET_PANEL_ID = "kv-create-secret-panel";
const CREATE_SECRET_NAME_INPUT_ID = "kv-create-secret-name-input";
const CREATE_SECRET_VALUE_INPUT_ID = "kv-create-secret-value-input";
const EXPORT_SECRETS_BUTTON_ID = "kv-export-secrets-button";
const IMPORT_SECRETS_BUTTON_ID = "kv-import-secrets-button";
const IMPORT_EXPORT_PANEL_ID = "kv-import-export-panel";
const SECRET_EXPORT_FORMAT = "azkv-secret-export";
const SECRET_EXPORT_VERSION = 1;
const SECRET_TRANSFER_CONCURRENCY = 4;
const NATIVE_NEW_SECRET_PATTERN = /generate\s*\/\s*import|new\s+secret/i;
const SORT_INDICATOR_CLASS = "kv-secret-sort-indicator";
const AUTO_LOAD_PROGRESS_CLICK_INTERVAL_MS = 300;
const AUTO_LOAD_STALLED_CLICK_INTERVAL_MS = 1200;
const AUTO_LOAD_MAX_STALLED_CLICKS = 3;
const AUTO_LOAD_SCROLL_HOLD_MS = 1000;

let isRevealed = false;
let renderGeneration = 0;
let lastPageKey = "";
let processTimer = null;
let secretCache = new Map();
let pendingFetches = new Map();
let secretCacheRevision = 0;
let secretValueWidthPx = DEFAULT_SECRET_VALUE_WIDTH_PX;
let searchQuery = "";
let searchDebounceTimer = null;
let sortDirection = "";
let sortRestorePending = false;
let autoLoadLastClickTime = 0;
let autoLoadLastRowCount = -1;
let autoLoadStalledClicks = 0;
let autoLoadStopped = false;
let autoLoadScrollBaseline = null;
let lastVersionsContext = null;
let createSecretPanelOpen = false;
let isSecretTransferBusy = false;

function getValidVaultName(value) {
    const vaultName = (value || "").trim();
    return /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/i.test(vaultName) ? vaultName : "";
}

function getValidSecretName(value) {
    const secretName = (value || "").trim();
    return /^[a-z0-9-]{1,127}$/i.test(secretName) ? secretName : "";
}

function getValidSecretVersion(value) {
    const versionText = (value || "").trim();
    const directMatch = versionText.match(/\b[a-f0-9]{32}\b/i);
    return directMatch?.[0] || "";
}

function getDecodedValue(value) {
    try {
        return decodeURIComponent(value || "");
    } catch {
        return value || "";
    }
}

function parseSecretIdentifier(value) {
    const decodedValue = getDecodedValue(value);
    const match = decodedValue.match(/\/secrets\/([^\/?#\s]+)\/(?:versions\/)?([a-f0-9]{32})(?=[\/?#\s]|$)/i);

    if (!match) {
        return null;
    }

    const secretName = getValidSecretName(match[1]);
    const version = getValidSecretVersion(match[2]);

    return secretName && version ? { secretName, version } : null;
}

function getSecretNameCandidates(value) {
    const decodedValue = getDecodedValue(value);
    const candidates = [];
    const addCandidate = (candidate) => {
        const secretName = getValidSecretName(candidate);
        const isVersion = Boolean(getValidSecretVersion(secretName));

        if (secretName && !isVersion && !candidates.includes(secretName)) {
            candidates.push(secretName);
        }
    };

    for (const match of decodedValue.matchAll(/\/secrets\/([^\/?#\s]+)/gi)) {
        addCandidate(match[1]);
    }

    const namedRouteMatch = decodedValue.match(/\/secretName\/([^\/?#\s]+)/i)
        || decodedValue.match(/[?&#]secretName=([^&#\s]+)/i);

    if (namedRouteMatch) {
        addCandidate(namedRouteMatch[1]);
    }

    return candidates;
}

function getVaultNameFromPage() {
    const decodedHref = getDecodedValue(window.location.href);
    const vaultMatches = Array.from(decodedHref.matchAll(/\/(?:providers\/Microsoft\.KeyVault\/)?vaults\/([^\/?#\s]+)/gi));
    const vaultMatch = vaultMatches[vaultMatches.length - 1];

    if (vaultMatch) {
        return getValidVaultName(vaultMatch[1]);
    }

    const titlePart = (document.title || "").split("|")[0];
    return getValidVaultName(titlePart);
}

function getSecretNameFromPage() {
    const candidates = getSecretNameCandidates(window.location.href);

    if (candidates.length > 0) {
        return candidates[candidates.length - 1];
    }

    const titlePart = (document.title || "").split("|")[0];
    return getValidSecretName(titlePart);
}

function normalizeHeaderText(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getHeaderCells(grid) {
    return Array.from(grid.querySelectorAll(".azc-grid-tableHead tr[role='row'] th"));
}

function getHeaderCellText(headerCell) {
    const label = headerCell.querySelector("[role='columnheader']") || headerCell;
    return normalizeHeaderText(label.textContent || "");
}

function getColumnIndexByHeader(grid, headerText) {
    const target = normalizeHeaderText(headerText);
    return getHeaderCells(grid).findIndex((headerCell) => getHeaderCellText(headerCell) === target);
}

function hasGridHeader(grid, headerText) {
    return getColumnIndexByHeader(grid, headerText) !== -1;
}

function findSecretsGrid() {
    const grids = Array.from(document.querySelectorAll('[role="grid"]'));

    if (getSecretNameFromPage()) {
        const versionGrid = grids.find((grid) => hasGridHeader(grid, "Version"));
        if (versionGrid) {
            return versionGrid;
        }
    }

    const candidates = grids.filter((grid) => {
        const label = (grid.getAttribute("aria-label") || "").toLowerCase();
        const caption = (grid.querySelector("caption")?.textContent || "").toLowerCase();
        return label.includes("key vault") && label.includes("secret")
            || caption.includes("key vault") && caption.includes("secret");
    });

    return candidates.find((grid) => hasGridHeader(grid, "Version")) || candidates[0] || null;
}

function findSecretsCommandBar() {
    const toolbars = Array.from(document.querySelectorAll(".fxs-commandBar ul[role='toolbar'], .azc-toolbar ul[role='toolbar'], ul.azc-toolbar-container[role='toolbar']"));

    return toolbars.find((toolbar) => {
        const text = (toolbar.textContent || "").toLowerCase();
        return text.includes("generate/import") && text.includes("refresh");
    }) || toolbars[0] || null;
}

function getSecretRows(grid) {
    return Array.from(grid.querySelectorAll("tbody tr[role='row']"));
}

function resetAutoLoadState() {
    autoLoadLastClickTime = 0;
    autoLoadLastRowCount = -1;
    autoLoadStalledClicks = 0;
    autoLoadStopped = false;
    autoLoadScrollBaseline = null;
}

function captureScrollPositions(grid) {
    const positions = [];
    let node = grid;

    while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight + 1) {
            positions.push([node, node.scrollTop, node.scrollLeft]);
        }
        node = node.parentElement;
    }

    const scrollingElement = document.scrollingElement || document.documentElement;
    positions.push([scrollingElement, scrollingElement.scrollTop, scrollingElement.scrollLeft]);
    return positions;
}

function restoreAutoLoadScroll() {
    if (!autoLoadScrollBaseline || Date.now() > autoLoadScrollBaseline.until) return;

    autoLoadScrollBaseline.positions.forEach(([element, scrollTop, scrollLeft]) => {
        if (!element.isConnected) return;

        if (element.scrollTop !== scrollTop) {
            element.scrollTop = scrollTop;
        }
        if (element.scrollLeft !== scrollLeft) {
            element.scrollLeft = scrollLeft;
        }
    });
}

function findLoadMoreControl(grid) {
    // Scope to the grid's blade so "Load more" controls elsewhere (e.g. notifications) are never matched.
    const container = grid.closest(".fxs-blade-content, .fxs-blade, .fxs-part") || grid.parentElement || grid;
    const candidates = Array.from(container.querySelectorAll("a, button, [role='button'], [role='link']"));

    return candidates.find((element) => {
        if (element.getClientRects().length === 0) return false;
        if (element.disabled || element.getAttribute("aria-disabled") === "true") return false;

        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        return /^load\s?more\b/i.test(text);
    }) || null;
}

function autoClickLoadMore(grid) {
    if (autoLoadStopped) return;

    const control = findLoadMoreControl(grid);
    if (!control) {
        autoLoadStalledClicks = 0;
        return;
    }

    const now = Date.now();
    const rowCount = getSecretRows(grid).length;
    const hasProgress = rowCount > autoLoadLastRowCount;
    // Re-click quickly while rows keep arriving; back off when a click produced no new rows yet.
    const requiredInterval = hasProgress ? AUTO_LOAD_PROGRESS_CLICK_INTERVAL_MS : AUTO_LOAD_STALLED_CLICK_INTERVAL_MS;

    if (autoLoadLastClickTime && now - autoLoadLastClickTime < requiredInterval) {
        return;
    }

    if (hasProgress) {
        autoLoadStalledClicks = 0;
    } else {
        autoLoadStalledClicks += 1;
        if (autoLoadStalledClicks >= AUTO_LOAD_MAX_STALLED_CLICKS) {
            autoLoadStopped = true;
            return;
        }
    }

    autoLoadLastRowCount = rowCount;
    autoLoadLastClickTime = now;

    // The portal scrolls toward the load-more control and freshly loaded rows
    // after a click. Pin the view to where it was until loading settles.
    if (!autoLoadScrollBaseline || now > autoLoadScrollBaseline.until) {
        autoLoadScrollBaseline = { positions: captureScrollPositions(grid), until: 0 };
    }
    autoLoadScrollBaseline.until = now + AUTO_LOAD_SCROLL_HOLD_MS;

    control.click();
    restoreAutoLoadScroll();
    window.requestAnimationFrame(restoreAutoLoadScroll);
    window.setTimeout(restoreAutoLoadScroll, 250);
    window.setTimeout(restoreAutoLoadScroll, 600);
}

function getCellText(row, columnIndex) {
    const cell = Array.from(row.querySelectorAll("td[role='gridcell']"))[columnIndex];
    const content = cell?.querySelector(".azc-grid-cellContent") || cell;
    return (content?.textContent || cell?.getAttribute("title") || cell?.getAttribute("aria-label") || "").trim();
}

function getCellSearchText(row, columnIndex) {
    const cell = Array.from(row.querySelectorAll("td[role='gridcell']"))[columnIndex];
    if (!cell) return "";

    const values = [cell.textContent || ""];
    const elements = [cell, ...Array.from(cell.querySelectorAll("*"))];

    elements.forEach((element) => {
        Array.from(element.attributes || []).forEach((attribute) => {
            if (attribute.value) {
                values.push(attribute.value);
            }
        });
    });

    return values.join(" ");
}

function getVersionRowSecretReference(row, mode) {
    const searchText = getCellSearchText(row, mode.versionColumnIndex);
    const parsedReference = parseSecretIdentifier(searchText);

    if (parsedReference) {
        return parsedReference;
    }

    const visibleVersion = getValidSecretVersion(getCellText(row, mode.versionColumnIndex));
    if (mode.secretName && visibleVersion) {
        return { secretName: mode.secretName, version: visibleVersion };
    }

    const secretNameCandidates = getSecretNameCandidates(searchText);
    const secretName = secretNameCandidates[secretNameCandidates.length - 1] || mode.secretName;
    const version = getValidSecretVersion(searchText);

    return secretName && version ? { secretName, version } : null;
}

function getSecretName(row, columnIndex = 0) {
    const nameCell = Array.from(row.querySelectorAll("td[role='gridcell']"))[columnIndex];
    const content = nameCell?.querySelector(".azc-grid-cellContent") || nameCell;
    return (content?.textContent || "").trim();
}

function resetRowState(root = document) {
    root.querySelectorAll("tr[data-kv-secret-state]").forEach((row) => {
        delete row.dataset.kvVaultName;
        delete row.dataset.kvSecretName;
        delete row.dataset.kvSecretVersion;
        delete row.dataset.kvSecretState;
        delete row.dataset.kvSecretEditable;
    });
}

function updateToggleButton(button) {
    const label = isRevealed ? "Hide Key Vault Secret Values" : "Show Key Vault Secret Values";
    const icon = isRevealed ? HIDE_SECRETS_ICON_SVG : SHOW_SECRETS_ICON_SVG;
    const iconState = isRevealed ? "hide" : "show";
    const iconElement = button.querySelector(".azc-toolbarButton-icon");
    const labelElement = button.querySelector(".azc-toolbarButton-label");
    const buttonElement = button.querySelector('[role="button"]');

    button.title = label;
    button.dataset.kvSecretRevealed = String(isRevealed);

    if (buttonElement) {
        buttonElement.setAttribute("aria-label", label);
        buttonElement.setAttribute("aria-pressed", String(isRevealed));
        buttonElement.setAttribute("title", label);
    }

    if (iconElement && button.dataset.kvToolbarIcon !== iconState) {
        iconElement.innerHTML = icon;
        button.dataset.kvToolbarIcon = iconState;
    }

    if (labelElement) {
        labelElement.textContent = label;
        labelElement.setAttribute("data-telemetryname", `Command-${label}`);
    }
}

function injectToggleButton() {
    const toolbar = findSecretsCommandBar();
    if (!toolbar) return;

    let button = document.getElementById(TOGGLE_ID);

    if (button && button.parentElement !== toolbar) {
        button.remove();
        button = null;
    }

    if (!button) {
        button = document.createElement("li");
        button.id = TOGGLE_ID;
        button.setAttribute("role", "presentation");
        button.className = "azc-toolbar-item azc-toolbarButton fxs-commandBar-item fxs-vivaresize";
        button.innerHTML = `<div class="azc-toolbarButton-container fxs-portal-hover" role="button" tabindex="0"><div class="azc-toolbarButton-icon"></div><div class="azc-toolbarButton-label fxs-commandBar-item-text"></div></div>`;

        const activate = (event) => {
            event.preventDefault();
            event.stopPropagation();
            isRevealed = !isRevealed;
            renderGeneration += 1;
            resetRowState();
            updateToggleButton(button);
            scheduleProcessGrid();
        };

        const command = button.querySelector('[role="button"]');
        command.addEventListener("click", activate);
        command.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                activate(event);
            }
        });
    }

    if (toolbar.lastElementChild !== button) {
        toolbar.appendChild(button);
    }
    updateToggleButton(button);
}

function removeToggleButton() {
    document.getElementById(TOGGLE_ID)?.remove();
}

function findNativeNewSecretItem(toolbar) {
    return Array.from(toolbar.children).find((item) => (
        item.id !== CREATE_SECRET_BUTTON_ID
        && item.id !== TOGGLE_ID
        && item.id !== EXPORT_SECRETS_BUTTON_ID
        && item.id !== IMPORT_SECRETS_BUTTON_ID
        && NATIVE_NEW_SECRET_PATTERN.test(item.textContent || "")
    )) || null;
}

function updateCreateSecretButton(button) {
    const label = "Create secret";
    const iconElement = button.querySelector(".azc-toolbarButton-icon");
    const labelElement = button.querySelector(".azc-toolbarButton-label");
    const buttonElement = button.querySelector('[role="button"]');

    button.title = label;

    if (buttonElement) {
        buttonElement.setAttribute("aria-label", label);
        buttonElement.setAttribute("aria-expanded", String(createSecretPanelOpen));
        buttonElement.setAttribute("aria-controls", CREATE_SECRET_PANEL_ID);
        buttonElement.setAttribute("title", label);
    }

    if (iconElement && button.dataset.kvToolbarIcon !== "create") {
        iconElement.innerHTML = CREATE_SECRET_ICON_SVG;
        button.dataset.kvToolbarIcon = "create";
    }

    if (labelElement && labelElement.textContent !== label) {
        labelElement.textContent = label;
        labelElement.setAttribute("data-telemetryname", `Command-${label}`);
    }
}

function injectCreateSecretButton() {
    const toolbar = findSecretsCommandBar();
    if (!toolbar) return;

    const nativeItem = findNativeNewSecretItem(toolbar);

    if (nativeItem && nativeItem.dataset.kvNativeNewHidden !== "true") {
        nativeItem.dataset.kvNativeNewHidden = "true";
        nativeItem.style.display = "none";
    }

    let button = document.getElementById(CREATE_SECRET_BUTTON_ID);

    if (button && button.parentElement !== toolbar) {
        button.remove();
        button = null;
    }

    if (!button) {
        button = document.createElement("li");
        button.id = CREATE_SECRET_BUTTON_ID;
        button.setAttribute("role", "presentation");
        button.className = "azc-toolbar-item azc-toolbarButton fxs-commandBar-item fxs-vivaresize";
        button.innerHTML = `<div class="azc-toolbarButton-container fxs-portal-hover" role="button" tabindex="0" aria-expanded="false"><div class="azc-toolbarButton-icon"></div><div class="azc-toolbarButton-label fxs-commandBar-item-text"></div></div>`;

        const activate = (event) => {
            event.preventDefault();
            event.stopPropagation();
            ensureCreateSecretPanel();
            setCreateSecretPanelOpen(!createSecretPanelOpen);
        };

        const command = button.querySelector('[role="button"]');
        command.addEventListener("click", activate);
        command.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                activate(event);
            }
        });
    }

    const exportButton = document.getElementById(EXPORT_SECRETS_BUTTON_ID);
    const importButton = document.getElementById(IMPORT_SECRETS_BUTTON_ID);
    const insertionAnchor = exportButton?.parentElement === toolbar
        ? exportButton
        : importButton?.parentElement === toolbar
            ? importButton
            : nativeItem;

    if (insertionAnchor) {
        if (button.nextElementSibling !== insertionAnchor) {
            toolbar.insertBefore(button, insertionAnchor);
        }
    } else if (button.parentElement !== toolbar) {
        toolbar.insertBefore(button, toolbar.firstElementChild);
    }

    updateCreateSecretButton(button);
}

function setCreateSecretPanelOpen(open) {
    createSecretPanelOpen = Boolean(open);

    const panel = document.getElementById(CREATE_SECRET_PANEL_ID);
    if (panel) {
        panel.style.maxHeight = createSecretPanelOpen ? `${panel.scrollHeight}px` : "0px";
    }

    const button = document.getElementById(CREATE_SECRET_BUTTON_ID);
    button?.querySelector('[role="button"]')?.setAttribute("aria-expanded", String(createSecretPanelOpen));

    if (createSecretPanelOpen) {
        // Focus once the slide-down transition has finished so the page does not jump.
        window.setTimeout(() => {
            document.getElementById(CREATE_SECRET_NAME_INPUT_ID)?.focus();
        }, 260);
    }
}

function clickNativeRefreshButton() {
    const toolbar = findSecretsCommandBar();
    if (!toolbar) return;

    const commands = Array.from(toolbar.querySelectorAll("[role='button']"));
    const refreshCommand = commands.find((command) => {
        const text = (command.textContent || "").replace(/\s+/g, " ").trim();
        return /^refresh$/i.test(text);
    });

    refreshCommand?.click();
}

function buildCreateSecretPanel() {
    const panel = document.createElement("div");
    panel.id = CREATE_SECRET_PANEL_ID;
    panel.style.cssText = "overflow:hidden;max-height:0;transition:max-height .25s ease;";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px;";

    const inputStyle = [
        "height:26px",
        "box-sizing:border-box",
        "padding:2px 8px",
        "border:1px solid rgba(128,128,128,.45)",
        "border-radius:3px",
        "background:transparent",
        "color:inherit",
        "font:inherit",
        "outline-offset:-1px"
    ].join(";");

    const nameInput = document.createElement("input");
    nameInput.id = CREATE_SECRET_NAME_INPUT_ID;
    nameInput.type = "text";
    nameInput.placeholder = "Secret name";
    nameInput.setAttribute("aria-label", "New secret name");
    nameInput.spellcheck = false;
    nameInput.autocomplete = "off";
    nameInput.style.cssText = `${inputStyle};flex:0 1 260px;min-width:140px;`;

    const valueInput = document.createElement("input");
    valueInput.id = CREATE_SECRET_VALUE_INPUT_ID;
    valueInput.type = "text";
    valueInput.placeholder = "Secret value";
    valueInput.setAttribute("aria-label", "New secret value");
    valueInput.spellcheck = false;
    valueInput.autocomplete = "off";
    valueInput.style.cssText = `${inputStyle};flex:1 1 320px;min-width:180px;max-width:520px;font-family:monospace;`;

    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.textContent = "Create";
    createButton.setAttribute("aria-label", "Create secret");
    createButton.style.cssText = [
        "flex:0 0 auto",
        "height:26px",
        "padding:0 14px",
        "border:1px solid rgba(16,124,16,.35)",
        "border-radius:3px",
        "background:rgba(16,124,16,.08)",
        "color:#107c10",
        "font:inherit",
        "cursor:pointer"
    ].join(";");

    const status = document.createElement("span");
    status.style.cssText = "flex:0 0 auto;font-size:12px;line-height:1;color:#605e5c;";

    let isCreating = false;

    const setStatus = (message, color = "#605e5c") => {
        status.textContent = message;
        status.style.color = color;
    };

    const setBusy = (busy) => {
        isCreating = busy;
        nameInput.disabled = busy;
        valueInput.disabled = busy;
        createButton.disabled = busy;
        createButton.style.cursor = busy ? "default" : "pointer";
    };

    const submit = () => {
        if (isCreating) return;

        const secretName = getValidSecretName(nameInput.value);
        if (!secretName) {
            setStatus("Invalid name: use 1-127 letters, digits, or dashes", "#a4262c");
            nameInput.focus();
            return;
        }

        if (!valueInput.value) {
            setStatus("Secret value is required", "#a4262c");
            valueInput.focus();
            return;
        }

        const vaultName = getVaultNameFromPage();
        if (!vaultName) {
            setStatus("Key vault not detected on this page", "#a4262c");
            return;
        }

        // Best-effort duplicate guard: a PUT on an existing name would silently
        // create a new version, so warn when the loaded list already has the name.
        const grid = findSecretsGrid();
        if (grid) {
            const mode = getGridMode(grid);
            const duplicate = mode.type === "secrets" && getSecretRows(grid).some((gridRow) => {
                const rowName = getValidSecretName(getSecretName(gridRow, mode.nameColumnIndex));
                return rowName && rowName.toLowerCase() === secretName.toLowerCase();
            });

            if (duplicate) {
                setStatus(`Secret "${secretName}" already exists`, "#a4262c");
                nameInput.focus();
                return;
            }
        }

        setBusy(true);
        setStatus("Creating...");

        saveSecretValue(vaultName, secretName, valueInput.value).then((result) => {
            setBusy(false);

            if (!Object.prototype.hasOwnProperty.call(result, "value")) {
                setStatus(result.error || "Create failed", "#a4262c");
                return;
            }

            setStatus("Created", "#107c10");
            nameInput.value = "";
            valueInput.value = "";

            window.setTimeout(() => {
                // Skip auto-close if the user already started a new entry.
                if (status.textContent !== "Created") return;

                setStatus("");
                setCreateSecretPanelOpen(false);
                clickNativeRefreshButton();
                scheduleProcessGrid();
            }, 1200);
        });
    };

    createButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
    });

    [nameInput, valueInput].forEach((input) => {
        input.addEventListener("input", () => {
            if (!isCreating) {
                setStatus("");
            }
        });

        input.addEventListener("keydown", (event) => {
            event.stopPropagation();

            if (event.key === "Enter") {
                event.preventDefault();
                submit();
            } else if (event.key === "Escape") {
                event.preventDefault();
                setCreateSecretPanelOpen(false);
            }
        });
    });

    [panel, row, nameInput, valueInput, createButton].forEach((element) => {
        ["click", "dblclick", "mousedown", "pointerdown"].forEach((eventName) => {
            element.addEventListener(eventName, (event) => event.stopPropagation());
        });
    });

    row.append(nameInput, valueInput, createButton, status);
    panel.append(row);
    return panel;
}

function ensureCreateSecretPanel() {
    let panel = document.getElementById(CREATE_SECRET_PANEL_ID);
    if (!panel) {
        panel = buildCreateSecretPanel();
    }

    const toolbar = findSecretsCommandBar();
    const commandBar = toolbar?.closest(".fxs-commandBar, .azc-toolbar");

    if (commandBar?.parentElement) {
        if (panel.previousElementSibling !== commandBar) {
            commandBar.insertAdjacentElement("afterend", panel);
        }
    } else {
        const grid = findSecretsGrid();
        if (grid?.parentElement && panel.parentElement !== grid.parentElement) {
            grid.parentElement.insertBefore(panel, grid);
        }
    }

    if (createSecretPanelOpen) {
        const openHeight = `${panel.scrollHeight}px`;
        if (panel.style.maxHeight !== openHeight) {
            panel.style.maxHeight = openHeight;
        }
    }

    return panel;
}

function removeCreateSecretUi() {
    document.getElementById(CREATE_SECRET_BUTTON_ID)?.remove();
    document.getElementById(CREATE_SECRET_PANEL_ID)?.remove();
    createSecretPanelOpen = false;

    document.querySelectorAll("[data-kv-native-new-hidden]").forEach((element) => {
        element.style.display = "";
        delete element.dataset.kvNativeNewHidden;
    });
}

function insertAfter(parent, element, previousSibling) {
    parent.insertBefore(element, previousSibling?.nextSibling || null);
}

function createToolbarButton(id, label, icon, onActivate) {
    const button = document.createElement("li");
    button.id = id;
    button.setAttribute("role", "presentation");
    button.className = "azc-toolbar-item azc-toolbarButton fxs-commandBar-item fxs-vivaresize";
    button.innerHTML = `<div class="azc-toolbarButton-container fxs-portal-hover" role="button" tabindex="0"><div class="azc-toolbarButton-icon"></div><div class="azc-toolbarButton-label fxs-commandBar-item-text"></div></div>`;

    const activate = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (isSecretTransferBusy) {
            return;
        }

        onActivate();
    };

    const command = button.querySelector('[role="button"]');
    button.addEventListener("click", activate);
    command.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            activate(event);
        }
    });

    updateToolbarButton(button, label, icon);
    return button;
}

function updateToolbarButton(button, label, icon) {
    const iconElement = button.querySelector(".azc-toolbarButton-icon");
    const labelElement = button.querySelector(".azc-toolbarButton-label");
    const buttonElement = button.querySelector('[role="button"]');
    const title = isSecretTransferBusy ? `${label} unavailable while another secret transfer is running` : label;

    button.title = title;
    button.style.opacity = isSecretTransferBusy ? ".55" : "";

    if (buttonElement) {
        buttonElement.setAttribute("aria-label", label);
        buttonElement.setAttribute("aria-disabled", String(isSecretTransferBusy));
        buttonElement.setAttribute("title", title);
    }

    if (iconElement && button.dataset.kvToolbarIcon !== label) {
        iconElement.innerHTML = icon;
        button.dataset.kvToolbarIcon = label;
    }

    if (labelElement && labelElement.textContent !== label) {
        labelElement.textContent = label;
        labelElement.setAttribute("data-telemetryname", `Command-${label}`);
    }
}

function updateImportExportButtons() {
    const exportButton = document.getElementById(EXPORT_SECRETS_BUTTON_ID);
    if (exportButton) {
        updateToolbarButton(exportButton, "Export secrets", EXPORT_SECRETS_ICON_SVG);
    }

    const importButton = document.getElementById(IMPORT_SECRETS_BUTTON_ID);
    if (importButton) {
        updateToolbarButton(importButton, "Import secrets", IMPORT_SECRETS_ICON_SVG);
    }
}

function injectImportExportButtons() {
    const toolbar = findSecretsCommandBar();
    if (!toolbar) return;

    let exportButton = document.getElementById(EXPORT_SECRETS_BUTTON_ID);
    if (exportButton && exportButton.parentElement !== toolbar) {
        exportButton.remove();
        exportButton = null;
    }

    if (!exportButton) {
        exportButton = createToolbarButton(EXPORT_SECRETS_BUTTON_ID, "Export secrets", EXPORT_SECRETS_ICON_SVG, handleExportSecrets);
    }

    let importButton = document.getElementById(IMPORT_SECRETS_BUTTON_ID);
    if (importButton && importButton.parentElement !== toolbar) {
        importButton.remove();
        importButton = null;
    }

    if (!importButton) {
        importButton = createToolbarButton(IMPORT_SECRETS_BUTTON_ID, "Import secrets", IMPORT_SECRETS_ICON_SVG, handleImportSecrets);
    }

    const createButton = document.getElementById(CREATE_SECRET_BUTTON_ID);
    const nativeItem = findNativeNewSecretItem(toolbar);

    if (createButton?.parentElement === toolbar) {
        if (createButton.nextElementSibling !== exportButton) {
            insertAfter(toolbar, exportButton, createButton);
        }
    } else if (nativeItem) {
        if (exportButton.nextElementSibling !== nativeItem) {
            toolbar.insertBefore(exportButton, nativeItem);
        }
    } else if (exportButton.parentElement !== toolbar) {
        const toggleButton = document.getElementById(TOGGLE_ID);
        toolbar.insertBefore(exportButton, toggleButton?.parentElement === toolbar ? toggleButton : null);
    }

    if (exportButton.nextElementSibling !== importButton) {
        insertAfter(toolbar, importButton, exportButton);
    }

    updateImportExportButtons();
}

function setSecretTransferBusy(busy) {
    isSecretTransferBusy = Boolean(busy);
    updateImportExportButtons();
}

function ensureImportExportPanel() {
    let panel = document.getElementById(IMPORT_EXPORT_PANEL_ID);
    if (!panel) {
        panel = document.createElement("div");
        panel.id = IMPORT_EXPORT_PANEL_ID;
        panel.setAttribute("role", "status");
        panel.setAttribute("aria-live", "polite");
        panel.style.cssText = "display:none;border-top:1px solid rgba(128,128,128,.25);border-bottom:1px solid rgba(128,128,128,.25);";
    }

    const toolbar = findSecretsCommandBar();
    const commandBar = toolbar?.closest(".fxs-commandBar, .azc-toolbar");
    const createPanel = document.getElementById(CREATE_SECRET_PANEL_ID);
    const anchor = createPanel?.parentElement ? createPanel : commandBar;

    if (anchor?.parentElement && panel.previousElementSibling !== anchor) {
        anchor.insertAdjacentElement("afterend", panel);
    }

    return panel;
}

function hideImportExportPanel() {
    const panel = document.getElementById(IMPORT_EXPORT_PANEL_ID);
    if (panel) {
        panel.style.display = "none";
        panel.textContent = "";
    }
}

function setImportExportPanel({ title, message, color = "#605e5c", actions = [] }) {
    const panel = ensureImportExportPanel();
    panel.textContent = "";
    panel.style.display = "block";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:flex-start;gap:12px;padding:8px 12px;";

    const content = document.createElement("div");
    content.style.cssText = "flex:1 1 auto;min-width:0;";

    const titleElement = document.createElement("div");
    titleElement.textContent = title;
    titleElement.style.cssText = "font-weight:600;margin-bottom:3px;";

    const messageElement = document.createElement("div");
    messageElement.textContent = message;
    messageElement.style.cssText = `font-size:12px;line-height:1.35;color:${color};white-space:pre-wrap;`;

    const actionBar = document.createElement("div");
    actionBar.style.cssText = "display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 1 auto;flex-wrap:wrap;";

    actions.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = action.label;
        button.style.cssText = [
            "height:26px",
            "padding:0 12px",
            "border:1px solid rgba(128,128,128,.45)",
            "border-radius:3px",
            "background:transparent",
            "color:inherit",
            "font:inherit",
            "cursor:pointer"
        ].join(";");

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            action.onClick();
        });

        actionBar.append(button);
    });

    if (panel.dataset.kvImportExportBound !== "true") {
        panel.dataset.kvImportExportBound = "true";
        ["click", "dblclick", "mousedown", "pointerdown"].forEach((eventName) => {
            panel.addEventListener(eventName, (event) => event.stopPropagation());
        });
    }

    ["click", "dblclick", "mousedown", "pointerdown"].forEach((eventName) => {
        row.addEventListener(eventName, (event) => event.stopPropagation());
    });

    content.append(titleElement, messageElement);
    row.append(content, actionBar);
    panel.append(row);
    return { panel, content, actionBar };
}

function removeImportExportUi() {
    document.getElementById(EXPORT_SECRETS_BUTTON_ID)?.remove();
    document.getElementById(IMPORT_SECRETS_BUTTON_ID)?.remove();
    hideImportExportPanel();
    isSecretTransferBusy = false;
}

function getSecretTransferNamesFromList(result) {
    if (!Array.isArray(result.secrets)) {
        return [];
    }

    const names = [];
    const seen = new Set();

    result.secrets.forEach((secret) => {
        const name = getValidSecretName(secret?.name);
        const key = name.toLowerCase();

        if (name && !seen.has(key)) {
            seen.add(key);
            names.push(name);
        }
    });

    return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function runWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);

    return Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await worker(items[index], index);
        }
    })).then(() => results);
}

function downloadJsonFile(fileName, data) {
    const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getExportFileName(vaultName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `key-vault-${vaultName}-secrets-${timestamp}.json`;
}

async function handleExportSecrets() {
    if (isSecretTransferBusy) return;

    const vaultName = getVaultNameFromPage();
    if (!vaultName) {
        setImportExportPanel({
            title: "Export secrets",
            message: "Key vault not detected on this page",
            color: "#a4262c"
        });
        return;
    }

    setSecretTransferBusy(true);

    try {
        setImportExportPanel({
            title: "Export secrets",
            message: "This creates a plain JSON file containing secret values. Listing secrets..."
        });

        const listResult = await requestSecretList(vaultName);
        if (!Array.isArray(listResult.secrets)) {
            throw new Error(listResult.error || "Secret list failed");
        }

        const names = getSecretTransferNamesFromList(listResult);
        if (names.length === 0) {
            setImportExportPanel({
                title: "Export secrets",
                message: `No secrets found in ${vaultName}`,
                color: "#107c10"
            });
            return;
        }

        let completed = 0;
        const failures = [];
        const exportedSecrets = new Array(names.length);

        await runWithConcurrency(names, SECRET_TRANSFER_CONCURRENCY, async (secretName, index) => {
            const result = await requestSecret(vaultName, secretName);
            completed += 1;

            if (Object.prototype.hasOwnProperty.call(result, "value")) {
                exportedSecrets[index] = {
                    name: secretName,
                    value: result.value
                };
            } else {
                failures.push({ name: secretName, error: result.error || "Fetch failed" });
            }

            setImportExportPanel({
                title: "Export secrets",
                message: `Fetching current values: ${completed} of ${names.length}`
            });
        });

        if (failures.length > 0) {
            const failedNames = failures.slice(0, 5).map((failure) => `${failure.name}: ${failure.error}`).join("\n");
            setImportExportPanel({
                title: "Export secrets",
                message: `Export stopped. ${failures.length} secret${failures.length === 1 ? "" : "s"} could not be fetched, so no partial file was created.\n${failedNames}`,
                color: "#a4262c"
            });
            return;
        }

        const exportData = {
            format: SECRET_EXPORT_FORMAT,
            version: SECRET_EXPORT_VERSION,
            sourceVault: vaultName,
            exportedAt: new Date().toISOString(),
            secrets: exportedSecrets
        };

        downloadJsonFile(getExportFileName(vaultName), exportData);
        setImportExportPanel({
            title: "Export secrets",
            message: `Exported ${exportedSecrets.length} secret${exportedSecrets.length === 1 ? "" : "s"} from ${vaultName}. Protect the downloaded JSON file.`,
            color: "#107c10"
        });
    } catch (error) {
        setImportExportPanel({
            title: "Export secrets",
            message: error.message || "Export failed",
            color: "#a4262c"
        });
    } finally {
        setSecretTransferBusy(false);
    }
}

function selectSecretImportFile() {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.style.display = "none";

        let resolved = false;
        const cleanup = (file) => {
            if (resolved) return;
            resolved = true;
            window.removeEventListener("focus", onFocus);
            input.remove();
            resolve(file);
        };
        const onFocus = () => {
            window.setTimeout(() => {
                if (!input.files?.length) {
                    cleanup(null);
                }
            }, 500);
        };

        input.addEventListener("change", () => {
            const file = input.files?.[0] || null;
            cleanup(file);
        }, { once: true });

        window.addEventListener("focus", onFocus, { once: true });
        document.body.append(input);
        input.click();
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
        reader.addEventListener("error", () => reject(new Error("Could not read import file")), { once: true });
        reader.readAsText(file);
    });
}

function parseSecretImportFile(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("Import file is not valid JSON");
    }

    if (!data || data.format !== SECRET_EXPORT_FORMAT || data.version !== SECRET_EXPORT_VERSION) {
        throw new Error("Import file does not use the supported Key Vault secret export format");
    }

    const sourceVault = typeof data.sourceVault === "string" ? getValidVaultName(data.sourceVault) : "";
    if (!sourceVault) {
        throw new Error("Import file has an invalid source vault");
    }

    if (!Array.isArray(data.secrets)) {
        throw new Error("Import file is missing a secrets array");
    }

    const seen = new Set();
    const secrets = data.secrets.map((secret, index) => {
        const name = typeof secret?.name === "string" ? getValidSecretName(secret.name) : "";
        if (!name) {
            throw new Error(`Secret at index ${index} has an invalid name`);
        }

        if (!Object.prototype.hasOwnProperty.call(secret, "value") || typeof secret.value !== "string") {
            throw new Error(`Secret "${name}" has an invalid value`);
        }

        const key = name.toLowerCase();
        if (seen.has(key)) {
            throw new Error(`Import file contains duplicate secret "${name}"`);
        }

        seen.add(key);
        return {
            name,
            value: secret.value
        };
    });

    return {
        sourceVault,
        exportedAt: String(data.exportedAt || ""),
        secrets
    };
}

function confirmSecretImport(importData, destinationVault, existingCount, newCount) {
    return new Promise((resolve) => {
        const total = importData.secrets.length;
        const exportedAt = importData.exportedAt ? `Exported at: ${importData.exportedAt}` : "";
        let existingSecretMode = "replace";

        const { content } = setImportExportPanel({
            title: "Confirm secret import",
            message: [
                `Source vault: ${importData.sourceVault}`,
                `Destination vault: ${destinationVault}`,
                `Secrets: ${total}`,
                `New secrets: ${newCount}`,
                `Existing names: ${existingCount}`,
                "Imported values are written with Key Vault set-secret permissions.",
                "No secret values are shown in this preview.",
                exportedAt
            ].filter(Boolean).join("\n"),
            actions: [
                {
                    label: "Import",
                    onClick: () => resolve(existingSecretMode)
                },
                {
                    label: "Cancel",
                    onClick: () => {
                        hideImportExportPanel();
                        resolve("");
                    }
                }
            ]
        });

        const fieldset = document.createElement("fieldset");
        fieldset.style.cssText = "display:flex;gap:16px;margin:8px 0 0;padding:0;border:0;flex-wrap:wrap;";

        const legend = document.createElement("legend");
        legend.textContent = "When a secret already exists:";
        legend.style.cssText = "font-size:12px;font-weight:600;margin-bottom:4px;";
        fieldset.append(legend);

        [
            {
                value: "replace",
                label: "Replace existing values (creates new versions)"
            },
            {
                value: "skip",
                label: "Skip existing secrets"
            }
        ].forEach((option, index) => {
            const label = document.createElement("label");
            label.style.cssText = "display:inline-flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;";

            const input = document.createElement("input");
            input.type = "radio";
            input.name = "kv-import-existing-secret-mode";
            input.value = option.value;
            input.checked = index === 0;
            input.addEventListener("change", () => {
                if (input.checked) {
                    existingSecretMode = input.value;
                }
            });

            label.append(input, document.createTextNode(option.label));
            fieldset.append(label);
        });

        content.append(fieldset);
    });
}

async function handleImportSecrets() {
    if (isSecretTransferBusy) return;

    const file = await selectSecretImportFile();
    if (!file) return;

    const destinationVault = getVaultNameFromPage();
    if (!destinationVault) {
        setImportExportPanel({
            title: "Import secrets",
            message: "Key vault not detected on this page",
            color: "#a4262c"
        });
        return;
    }

    setSecretTransferBusy(true);

    try {
        setImportExportPanel({
            title: "Import secrets",
            message: "Reading and validating import file..."
        });

        const text = await readFileAsText(file);
        const importData = parseSecretImportFile(text);

        setImportExportPanel({
            title: "Import secrets",
            message: `Checking existing names in ${destinationVault}...`
        });

        const listResult = await requestSecretList(destinationVault);
        if (!Array.isArray(listResult.secrets)) {
            throw new Error(listResult.error || "Secret list failed");
        }

        const existingNames = new Set(getSecretTransferNamesFromList(listResult).map((name) => name.toLowerCase()));
        const existingCount = importData.secrets.filter((secret) => existingNames.has(secret.name.toLowerCase())).length;
        const newCount = importData.secrets.length - existingCount;

        const existingSecretMode = await confirmSecretImport(importData, destinationVault, existingCount, newCount);
        if (!existingSecretMode) {
            return;
        }

        const secretsToImport = existingSecretMode === "skip"
            ? importData.secrets.filter((secret) => !existingNames.has(secret.name.toLowerCase()))
            : importData.secrets;
        const skippedCount = importData.secrets.length - secretsToImport.length;

        if (secretsToImport.length === 0) {
            setImportExportPanel({
                title: "Import secrets",
                message: `No secrets were imported. Skipped ${skippedCount} existing secret${skippedCount === 1 ? "" : "s"}.`,
                color: "#107c10"
            });
            return;
        }

        let completed = 0;
        let succeeded = 0;
        const failures = [];

        await runWithConcurrency(secretsToImport, SECRET_TRANSFER_CONCURRENCY, async (secret) => {
            const result = await saveSecretValue(destinationVault, secret.name, secret.value);
            completed += 1;

            if (Object.prototype.hasOwnProperty.call(result, "value")) {
                succeeded += 1;
            } else {
                failures.push({ name: secret.name, error: result.error || "Import failed" });
            }

            setImportExportPanel({
                title: "Import secrets",
                message: `Writing secrets: ${completed} of ${secretsToImport.length}${skippedCount ? ` (${skippedCount} existing skipped)` : ""}`
            });
        });

        renderGeneration += 1;
        resetRowState();
        clickNativeRefreshButton();
        scheduleProcessGrid();

        if (failures.length > 0) {
            const failedNames = failures.slice(0, 5).map((failure) => `${failure.name}: ${failure.error}`).join("\n");
            setImportExportPanel({
                title: "Import secrets",
                message: `Imported ${succeeded} of ${secretsToImport.length} selected secret${secretsToImport.length === 1 ? "" : "s"}. ${failures.length} failed.${skippedCount ? ` ${skippedCount} existing skipped.` : ""}\n${failedNames}`,
                color: "#a4262c"
            });
            return;
        }

        setImportExportPanel({
            title: "Import secrets",
            message: `Imported ${succeeded} secret${succeeded === 1 ? "" : "s"} into ${destinationVault}.${skippedCount ? ` Skipped ${skippedCount} existing secret${skippedCount === 1 ? "" : "s"}.` : ""} The list was refreshed.`,
            color: "#107c10"
        });
    } catch (error) {
        setImportExportPanel({
            title: "Import secrets",
            message: error.message || "Import failed",
            color: "#a4262c"
        });
    } finally {
        setSecretTransferBusy(false);
    }
}

function getSecretValueWidth() {
    return `${secretValueWidthPx}px`;
}

function clampSecretValueWidth(widthPx) {
    return Math.max(MIN_SECRET_VALUE_WIDTH_PX, Math.min(MAX_SECRET_VALUE_WIDTH_PX, widthPx));
}

function applySecretValueColumnWidth(root = document) {
    const width = getSecretValueWidth();
    const createdDateWidth = `${CREATED_DATE_WIDTH_PX}px`;

    root.querySelectorAll(`.${COL_CLASS}, .${HEADER_CLASS}, .${COLUMN_CLASS}`).forEach((element) => {
        element.style.width = width;
        element.style.minWidth = width;
    });

    root.querySelectorAll(`.${CREATED_DATE_COL_CLASS}, .${CREATED_DATE_HEADER_CLASS}, .${CREATED_DATE_COLUMN_CLASS}`).forEach((element) => {
        element.style.width = createdDateWidth;
        element.style.minWidth = createdDateWidth;
    });

    root.querySelectorAll("table[data-kv-original-width]").forEach((table) => {
        const originalWidth = Number.parseFloat(table.dataset.kvOriginalWidth);
        if (Number.isFinite(originalWidth) && originalWidth > 0) {
            table.style.width = `${originalWidth + getInjectedColumnsWidth(table)}px`;
        }
    });
}

function setSecretValueColumnWidth(widthPx) {
    secretValueWidthPx = clampSecretValueWidth(Math.round(widthPx));
    applySecretValueColumnWidth();
}

function attachValueColumnResize(headerCell) {
    const handle = headerCell.querySelector(`.${RESIZE_HANDLE_CLASS}`);
    if (!handle || handle.dataset.kvResizeBound === "true") return;

    handle.dataset.kvResizeBound = "true";
    handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = secretValueWidthPx;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;

        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onPointerMove = (moveEvent) => {
            setSecretValueColumnWidth(startWidth + moveEvent.clientX - startX);
        };

        const onPointerUp = () => {
            document.removeEventListener("pointermove", onPointerMove);
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp, { once: true });
    });
}

function hasElementWithClass(root, className) {
    return root.classList?.contains(className) || Boolean(root.querySelector?.(`.${className}`));
}

function getInjectedColumnsWidth(root) {
    let width = 0;
    const grid = root.closest?.('[role="grid"]') || root;

    if (hasElementWithClass(grid, COL_CLASS) || hasElementWithClass(grid, HEADER_CLASS) || hasElementWithClass(grid, COLUMN_CLASS)) {
        width += secretValueWidthPx;
    }

    if (
        hasElementWithClass(grid, CREATED_DATE_COL_CLASS)
        || hasElementWithClass(grid, CREATED_DATE_HEADER_CLASS)
        || hasElementWithClass(grid, CREATED_DATE_COLUMN_CLASS)
    ) {
        width += CREATED_DATE_WIDTH_PX;
    }

    return width;
}

function ensureColgroupColumn(table, className, insertIndex) {
    const colgroup = table?.querySelector("colgroup");
    if (!colgroup) return;

    const tableWidth = Number.parseFloat(table.style.width);
    if (!table.dataset.kvOriginalWidth && Number.isFinite(tableWidth) && tableWidth > 0) {
        table.dataset.kvOriginalWidth = table.style.width;
        table.style.width = `${tableWidth + secretValueWidthPx}px`;
    }

    let col = colgroup.querySelector(`.${className}`);
    if (!col) {
        col = document.createElement("col");
        col.className = className;
    }

    if (colgroup.children[insertIndex] !== col) {
        colgroup.insertBefore(col, colgroup.children[insertIndex] || null);
    }

    applySecretValueColumnWidth(table);
}

function createHeaderCell(label, className, resizable) {
    const headerCell = document.createElement("th");
    headerCell.scope = "col";
    headerCell.setAttribute("role", "presentation");
    headerCell.className = `azc-grid-column-header azc-br-muted ${className}`;
    headerCell.innerHTML = `<div class="azc-grid-header-wrapper" role="presentation" style="display: flex; align-items: center; width: 100%; height: 100%;"><span role="columnheader" aria-readonly="true" class="azc-grid-headerlabel azc-grid-headerCell" tabindex="-1"></span></div>`;

    if (resizable) {
        const wrapper = headerCell.querySelector(".azc-grid-header-wrapper");
        const handle = document.createElement("div");
        handle.className = `azc-grid-resizableColumn-handle ${RESIZE_HANDLE_CLASS}`;
        handle.setAttribute("role", "presentation");
        handle.style.cssText = "cursor: col-resize; display: flex; align-items: stretch; align-self: stretch; margin-left: auto; padding: 0 4px;";
        handle.innerHTML = '<div class="azc-grid-resizableColumn-handle-line azc-bg-muted" role="presentation"></div>';
        wrapper.appendChild(handle);
    }

    const headerLabel = headerCell.querySelector("[role='columnheader']");
    headerLabel.textContent = label;
    return headerCell;
}

function ensureHeaderCell(headerRow, config, insertIndex) {
    let headerCell = headerRow.querySelector(`.${config.headerClass}`);
    if (!headerCell) {
        headerCell = createHeaderCell(config.label, config.headerClass, config.resizable);
    }

    const label = headerCell.querySelector("[role='columnheader']");
    if (label) {
        label.textContent = config.label;
    }

    const wrapper = headerCell.querySelector(".azc-grid-header-wrapper") || headerCell;
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";

    if (config.resizable && !headerCell.querySelector(`.${RESIZE_HANDLE_CLASS}`)) {
        const handle = document.createElement("div");
        handle.className = `azc-grid-resizableColumn-handle ${RESIZE_HANDLE_CLASS}`;
        handle.setAttribute("role", "presentation");
        handle.style.cssText = "cursor: col-resize; display: flex; align-items: stretch; align-self: stretch; margin-left: auto; padding: 0 4px;";
        handle.innerHTML = '<div class="azc-grid-resizableColumn-handle-line azc-bg-muted" role="presentation"></div>';
        wrapper.appendChild(handle);
    }

    if (headerRow.children[insertIndex] !== headerCell) {
        headerRow.insertBefore(headerCell, headerRow.children[insertIndex] || null);
    }

    if (config.resizable) {
        attachValueColumnResize(headerCell);
    }

    return headerCell;
}

function ensureGridColumns(grid, mode) {
    const currentCount = Number(grid.getAttribute("aria-colcount"));
    const insertedColumns = mode.columns.length;

    if (!grid.dataset.kvOriginalColcount && Number.isFinite(currentCount) && currentCount > 0) {
        grid.dataset.kvOriginalColcount = String(currentCount);
    }

    const originalCount = Number(grid.dataset.kvOriginalColcount) || currentCount;
    if (Number.isFinite(originalCount) && originalCount > 0) {
        grid.setAttribute("aria-colcount", String(originalCount + insertedColumns));
    }

    const headerRow = grid.querySelector(".azc-grid-tableHead tr[role='row']");
    if (!headerRow) return;

    const headerTable = grid.querySelector("table.azc-grid-tableHeader");
    const bodyTable = grid.querySelector("table.azc-grid-full");
    mode.columns.forEach((config, offset) => {
        const insertIndex = mode.insertIndex + offset;
        ensureColgroupColumn(headerTable, config.colClass, insertIndex);
        ensureColgroupColumn(bodyTable, config.colClass, insertIndex);
        ensureHeaderCell(headerRow, config, insertIndex);
    });

    applySecretValueColumnWidth(grid);
}

function ensureInjectedCell(row, config, insertIndex) {
    let cell = row.querySelector(`td.${config.cellClass}`);

    if (!cell) {
        cell = document.createElement("td");
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-readonly", "true");
        cell.className = `azc-grid-cell azc-br-muted ${config.cellClass}`;
        cell.innerHTML = `<div class="azc-grid-cellContent" style="${config.contentStyle}"></div>`;
    }

    if (row.children[insertIndex] !== cell) {
        row.insertBefore(cell, row.children[insertIndex] || null);
    }

    Array.from(row.querySelectorAll("td[role='gridcell']")).forEach((gridCell, index) => {
        gridCell.setAttribute("aria-colindex", String(index + 1));
    });

    applySecretValueColumnWidth(row);
    return cell.querySelector(".azc-grid-cellContent") || cell;
}

function ensureValueCell(row, insertIndex = 1) {
    return ensureInjectedCell(row, VALUE_COLUMN, insertIndex);
}

function cleanupInjectedGrid(grid) {
    grid.querySelectorAll(`.${HEADER_CLASS}, .${COLUMN_CLASS}, .${COL_CLASS}, .${CREATED_DATE_HEADER_CLASS}, .${CREATED_DATE_COLUMN_CLASS}, .${CREATED_DATE_COL_CLASS}`).forEach((element) => element.remove());
    grid.querySelectorAll("table[data-kv-original-width]").forEach((table) => {
        table.style.width = table.dataset.kvOriginalWidth;
        delete table.dataset.kvOriginalWidth;
    });

    if (grid.dataset.kvOriginalColcount) {
        grid.setAttribute("aria-colcount", grid.dataset.kvOriginalColcount);
        delete grid.dataset.kvOriginalColcount;
    }

    grid.querySelectorAll(`.${SORT_INDICATOR_CLASS}`).forEach((element) => element.remove());
    grid.querySelectorAll("th[data-kv-sort-bound]").forEach((headerCell) => {
        headerCell.removeEventListener("click", handleSortHeaderClick);
        headerCell.style.cursor = "";
        headerCell.removeAttribute("title");
        headerCell.removeAttribute("aria-sort");
        delete headerCell.dataset.kvSortBound;
    });

    grid.querySelectorAll("tr[data-kv-search-hidden]").forEach((row) => {
        row.style.display = "";
        delete row.dataset.kvSearchHidden;
    });
    grid.querySelectorAll("tr[data-kv-original-index]").forEach((row) => {
        delete row.dataset.kvOriginalIndex;
    });

    removeSearchBar();
    delete grid.dataset.kvGridMode;
}

function getSecretCacheKey(vaultName, secretName, version = "") {
    return `${vaultName}/${secretName}/${version || "current"}`;
}

function clearSecretCache(vaultName, secretName) {
    // Key Vault names are case-insensitive; the page URL and the grid cell may disagree on casing.
    const cacheKeyPrefix = `${vaultName}/${secretName}/`.toLowerCase();
    secretCacheRevision += 1;

    Array.from(secretCache.keys()).forEach((cacheKey) => {
        if (cacheKey.toLowerCase().startsWith(cacheKeyPrefix)) {
            secretCache.delete(cacheKey);
        }
    });

    Array.from(pendingFetches.keys()).forEach((cacheKey) => {
        if (cacheKey.toLowerCase().startsWith(cacheKeyPrefix)) {
            pendingFetches.delete(cacheKey);
        }
    });
}

function requestSecret(vaultName, secretName, version = "") {
    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
            resolve({ error: "Extension runtime unavailable" });
            return;
        }

        chrome.runtime.sendMessage({ action: "fetchSecret", vaultName, secretName, version }, (response) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                resolve({ error: runtimeError.message || "Background message failed" });
            } else if (!response) {
                resolve({ error: "No response from background" });
            } else if (Object.prototype.hasOwnProperty.call(response, "value")) {
                resolve({
                    value: response.value ?? "",
                    created: response.created ?? null
                });
            } else {
                resolve({ error: response.error || "Unexpected background response" });
            }
        });
    });
}

function requestSecretUpdate(vaultName, secretName, value) {
    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
            resolve({ error: "Extension runtime unavailable" });
            return;
        }

        chrome.runtime.sendMessage({ action: "setSecret", vaultName, secretName, value }, (response) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                resolve({ error: runtimeError.message || "Background message failed" });
            } else if (!response) {
                resolve({ error: "No response from background" });
            } else if (Object.prototype.hasOwnProperty.call(response, "value")) {
                resolve({
                    value: response.value ?? "",
                    created: response.created ?? null,
                    id: response.id || ""
                });
            } else {
                resolve({ error: response.error || "Unexpected background response" });
            }
        });
    });
}

function requestSecretList(vaultName) {
    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
            resolve({ error: "Extension runtime unavailable" });
            return;
        }

        chrome.runtime.sendMessage({ action: "listSecrets", vaultName }, (response) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                resolve({ error: runtimeError.message || "Background message failed" });
            } else if (!response) {
                resolve({ error: "No response from background" });
            } else if (Array.isArray(response.secrets)) {
                resolve({ secrets: response.secrets });
            } else {
                resolve({ error: response.error || "Unexpected background response" });
            }
        });
    });
}

function fetchSecretValue(vaultName, secretName, version = "") {
    const cacheKey = getSecretCacheKey(vaultName, secretName, version);

    if (secretCache.has(cacheKey)) {
        return Promise.resolve(secretCache.get(cacheKey));
    }

    if (pendingFetches.has(cacheKey)) {
        return pendingFetches.get(cacheKey);
    }

    const revisionAtFetch = secretCacheRevision;
    const promise = requestSecret(vaultName, secretName, version)
        .then((result) => {
            if (Object.prototype.hasOwnProperty.call(result, "value") && revisionAtFetch === secretCacheRevision) {
                secretCache.set(cacheKey, {
                    value: result.value,
                    created: result.created ?? null
                });
            }
            return result;
        })
        .finally(() => {
            pendingFetches.delete(cacheKey);
        });

    pendingFetches.set(cacheKey, promise);
    return promise;
}

function saveSecretValue(vaultName, secretName, value) {
    clearSecretCache(vaultName, secretName);

    return requestSecretUpdate(vaultName, secretName, value).then((result) => {
        if (Object.prototype.hasOwnProperty.call(result, "value")) {
            clearSecretCache(vaultName, secretName);
            secretCache.set(getSecretCacheKey(vaultName, secretName), {
                value: result.value,
                created: result.created ?? null
            });
        }

        return result;
    });
}

async function copyTextToClipboard(text) {
    const value = String(text ?? "");

    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // Fall through for browsers that expose the API but block it in content scripts.
        }
    }

    const textarea = document.createElement("textarea");
    const activeElement = document.activeElement;
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
    (document.body || document.documentElement).append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    let copied = false;

    try {
        copied = document.execCommand("copy");
    } finally {
        textarea.remove();

        if (activeElement instanceof HTMLElement) {
            activeElement.focus({ preventScroll: true });
        }
    }

    if (!copied) {
        throw new Error("Clipboard copy failed");
    }
}

function setCopyButtonDisabled(button, disabled) {
    button.disabled = disabled;
    button.style.cursor = disabled ? "default" : "pointer";
    button.style.opacity = disabled ? "0.45" : "1";
}

function createCopyValueButton({ getValue, label }) {
    const button = document.createElement("button");
    const defaultBorder = "rgba(128,128,128,.35)";
    const defaultBackground = "rgba(128,128,128,.08)";
    const defaultColor = "#605e5c";
    let feedbackTimer = null;

    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = COPY_VALUE_ICON_SVG;
    button.style.cssText = [
        "position:absolute",
        "right:2px",
        "top:50%",
        "transform:translateY(-50%)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "width:20px",
        "height:20px",
        "padding:0",
        `border:1px solid ${defaultBorder}`,
        "border-radius:3px",
        `background:${defaultBackground}`,
        `color:${defaultColor}`,
        "cursor:pointer"
    ].join(";");

    const showFeedback = (message, border, background, color) => {
        if (feedbackTimer !== null) {
            window.clearTimeout(feedbackTimer);
        }

        button.title = message;
        button.setAttribute("aria-label", message);
        button.style.borderColor = border;
        button.style.background = background;
        button.style.color = color;

        feedbackTimer = window.setTimeout(() => {
            feedbackTimer = null;
            button.title = label;
            button.setAttribute("aria-label", label);
            button.style.borderColor = defaultBorder;
            button.style.background = defaultBackground;
            button.style.color = defaultColor;
            setCopyButtonDisabled(button, String(getValue() ?? "").length === 0);
        }, 1200);
    };

    button.addEventListener("keydown", (event) => {
        event.stopPropagation();
    });

    button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const value = String(getValue() ?? "");
        if (!value) {
            return;
        }

        setCopyButtonDisabled(button, true);

        try {
            await copyTextToClipboard(value);
            showFeedback("Copied", "rgba(16,124,16,.5)", "rgba(16,124,16,.08)", "#107c10");
        } catch (error) {
            console.warn("[KV Ext] Copy failed:", error);
            showFeedback("Copy failed", "rgba(209,52,56,.5)", "rgba(209,52,56,.08)", "#d13438");
        }
    });

    setCopyButtonDisabled(button, String(getValue() ?? "").length === 0);
    return button;
}

function renderEditableSecretValue(content, options) {
    const { vaultName, secretName, value, isCurrent, onSaved } = options;
    let originalValue = String(value ?? "");
    let isSaving = false;
    let statusMessage = "";

    content.textContent = "";
    content.title = originalValue;
    content.style.color = "";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;min-width:0;";

    const inputWrapper = document.createElement("div");
    inputWrapper.style.cssText = "position:relative;display:flex;flex:1 1 auto;min-width:0;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = originalValue;
    input.spellcheck = false;
    input.setAttribute("aria-label", `Secret value for ${secretName}`);
    input.style.cssText = [
        "width:100%",
        "min-width:0",
        "box-sizing:border-box",
        "height:24px",
        "padding:1px 28px 1px 6px",
        "border:1px solid rgba(128,128,128,.45)",
        "border-radius:3px",
        "background:transparent",
        "color:#d13438",
        "font:inherit",
        "font-family:monospace",
        "overflow:hidden",
        "text-overflow:ellipsis"
    ].join(";");

    const copyButton = createCopyValueButton({
        getValue: () => input.value,
        label: `Copy secret value for ${secretName}`
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.title = "Create new secret version";
    saveButton.setAttribute("aria-label", "Create new secret version");
    saveButton.innerHTML = SAVE_SECRET_ICON_SVG;
    saveButton.style.cssText = [
        "position:absolute",
        "right:24px",
        "top:50%",
        "transform:translateY(-50%)",
        "display:none",
        "align-items:center",
        "justify-content:center",
        "width:20px",
        "height:20px",
        "padding:0",
        "border:1px solid rgba(16,124,16,.35)",
        "border-radius:3px",
        "background:rgba(16,124,16,.08)",
        "color:#107c10",
        "cursor:pointer"
    ].join(";");

    const status = document.createElement("span");
    status.style.cssText = "flex:0 0 auto;font-size:11px;line-height:1;color:#605e5c;";

    const setStatus = (message, color = "#605e5c") => {
        statusMessage = message;
        status.textContent = message;
        status.style.color = color;
        content.title = message ? `${message}: ${input.value}` : input.value;
    };

    const updateDirtyState = () => {
        const isDirty = input.value !== originalValue;
        saveButton.style.display = isDirty ? "flex" : "none";
        saveButton.disabled = !isDirty || isSaving;
        saveButton.style.cursor = saveButton.disabled ? "default" : "pointer";
        input.style.paddingRight = isDirty ? "50px" : "28px";
        setCopyButtonDisabled(copyButton, input.value.length === 0);
        content.title = statusMessage ? `${statusMessage}: ${input.value}` : input.value;
    };

    input.addEventListener("input", () => {
        if (isSaving) return;
        setStatus("");
        updateDirtyState();
    });

    input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
            event.preventDefault();
        }
    });

    [wrapper, input, saveButton, copyButton].forEach((element) => {
        ["click", "dblclick", "mousedown", "pointerdown"].forEach((eventName) => {
            element.addEventListener(eventName, (event) => {
                event.stopPropagation();
            });
        });
    });

    saveButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const nextValue = input.value;
        if (nextValue === originalValue || isSaving) {
            return;
        }

        isSaving = true;
        input.disabled = true;
        saveButton.disabled = true;
        setStatus("Saving...");
        updateDirtyState();

        saveSecretValue(vaultName, secretName, nextValue).then((result) => {
            if (!isCurrent()) {
                return;
            }

            isSaving = false;
            input.disabled = false;

            if (!Object.prototype.hasOwnProperty.call(result, "value")) {
                setStatus(result.error || "Save failed", "#a4262c");
                updateDirtyState();
                return;
            }

            originalValue = result.value;
            input.value = originalValue;
            setStatus("Saved", "#107c10");
            updateDirtyState();

            window.setTimeout(() => {
                if (isCurrent() && input.value === originalValue) {
                    onSaved(result);
                }
            }, 1200);
        });
    });

    inputWrapper.append(input, saveButton, copyButton);
    wrapper.append(inputWrapper, status);
    content.append(wrapper);
}

function renderReadonlySecretValue(content, value, hint) {
    const displayValue = String(value ?? "");

    content.textContent = "";
    content.title = `${hint}: ${displayValue}`;
    content.style.color = "";

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;min-width:0;";

    const inputWrapper = document.createElement("div");
    inputWrapper.style.cssText = "position:relative;display:flex;flex:1 1 auto;min-width:0;";

    const input = document.createElement("input");
    input.type = "text";
    input.value = displayValue;
    input.disabled = true;
    input.spellcheck = false;
    input.setAttribute("aria-label", hint);
    input.title = `${hint}: ${displayValue}`;
    input.style.cssText = [
        "width:100%",
        "min-width:0",
        "box-sizing:border-box",
        "height:24px",
        "padding:1px 28px 1px 6px",
        "border:1px solid rgba(128,128,128,.22)",
        "border-radius:3px",
        "background:rgba(128,128,128,.04)",
        "color:#605e5c",
        "font:inherit",
        "font-family:monospace",
        "overflow:hidden",
        "text-overflow:ellipsis"
    ].join(";");

    const copyButton = createCopyValueButton({
        getValue: () => input.value,
        label: `Copy ${hint.toLowerCase()}`
    });

    [wrapper, input, copyButton].forEach((element) => {
        ["click", "dblclick", "mousedown", "pointerdown", "keydown"].forEach((eventName) => {
            element.addEventListener(eventName, (event) => {
                event.stopPropagation();
            });
        });
    });

    inputWrapper.append(input, copyButton);
    wrapper.append(inputWrapper);
    content.append(wrapper);
}

function renderHidden(content) {
    content.textContent = MASKED_VALUE;
    content.title = "Hidden";
    content.style.color = "#888";
}

function renderEmpty(content) {
    content.textContent = "";
    content.title = "";
    content.style.color = "";
}

function formatCreatedDate(created) {
    const createdSeconds = Number(created);
    if (!Number.isFinite(createdSeconds) || createdSeconds <= 0) {
        return "";
    }

    const createdDate = new Date(createdSeconds * 1000);
    if (Number.isNaN(createdDate.getTime())) {
        return "";
    }

    return createdDate.toLocaleString();
}

function getGridMode(grid) {
    const versionColumnIndex = getColumnIndexByHeader(grid, "Version");
    const pageSecretName = getSecretNameFromPage();

    if (versionColumnIndex !== -1 && pageSecretName) {
        return {
            type: "versions",
            columns: [VALUE_COLUMN, CREATED_DATE_COLUMN],
            insertIndex: versionColumnIndex + 1,
            secretName: pageSecretName,
            versionColumnIndex
        };
    }

    const nameColumnIndex = Math.max(getColumnIndexByHeader(grid, "Name"), 0);
    return {
        type: "secrets",
        columns: [VALUE_COLUMN],
        insertIndex: nameColumnIndex + 1,
        nameColumnIndex
    };
}

function prepareGridForMode(grid, mode) {
    if (grid.dataset.kvGridMode && grid.dataset.kvGridMode !== mode.type) {
        cleanupInjectedGrid(grid);
    }

    grid.dataset.kvGridMode = mode.type;
    ensureGridColumns(grid, mode);
}

function removeSearchBar() {
    document.getElementById(SEARCH_BAR_ID)?.remove();
}

function resetSearchState() {
    searchQuery = "";
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    removeSearchBar();

    document.querySelectorAll("tr[data-kv-search-hidden]").forEach((row) => {
        row.style.display = "";
        delete row.dataset.kvSearchHidden;
    });
}

function createSearchBar() {
    const bar = document.createElement("div");
    bar.id = SEARCH_BAR_ID;
    bar.style.cssText = "display:flex;align-items:center;justify-content:flex-start;gap:8px;margin:0.5rem 0 0.5rem 3rem;";

    const input = document.createElement("input");
    input.id = SEARCH_INPUT_ID;
    input.type = "search";
    input.placeholder = "Search secrets by name";
    input.setAttribute("aria-label", "Search secrets by name");
    input.spellcheck = false;
    input.autocomplete = "off";
    input.style.cssText = [
        "flex:0 1 280px",
        "min-width:160px",
        "height:26px",
        "box-sizing:border-box",
        "padding:2px 8px",
        "border:1px solid rgba(128,128,128,.45)",
        "border-radius:3px",
        "background:transparent",
        "color:inherit",
        "font:inherit",
        "outline-offset:-1px"
    ].join(";");

    const count = document.createElement("span");
    count.className = SEARCH_COUNT_CLASS;
    count.style.cssText = "flex:0 0 auto;font-size:12px;color:#605e5c;";

    const applyQuery = () => {
        searchQuery = input.value;
        scheduleProcessGrid();
    };

    input.addEventListener("input", () => {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = window.setTimeout(applyQuery, 150);
    });

    // Fires when the native clear (x) button of a search input is used.
    input.addEventListener("search", applyQuery);

    input.addEventListener("keydown", (event) => {
        event.stopPropagation();

        if (event.key === "Escape" && input.value) {
            event.preventDefault();
            input.value = "";
            applyQuery();
        }
    });

    ["click", "dblclick", "mousedown", "pointerdown"].forEach((eventName) => {
        input.addEventListener(eventName, (event) => event.stopPropagation());
    });

    // Counter sits left of the input so its changing width never shifts the input.
    bar.append(count, input);
    return bar;
}

function ensureSearchBar(grid, mode) {
    if (mode.type !== "secrets") {
        removeSearchBar();
        return;
    }

    const gridParent = grid.parentElement;
    if (!gridParent) return;

    const bar = document.getElementById(SEARCH_BAR_ID) || createSearchBar();

    if (bar.parentElement !== gridParent || bar.nextElementSibling !== grid) {
        gridParent.insertBefore(bar, grid);
    }
}

function updateSearchCount(text) {
    const count = document.querySelector(`#${SEARCH_BAR_ID} .${SEARCH_COUNT_CLASS}`);
    if (count && count.textContent !== text) {
        count.textContent = text;
    }
}

function applySearchFilter(grid, mode) {
    if (mode.type !== "secrets") return;

    const query = searchQuery.trim().toLowerCase();
    let totalCount = 0;
    let matchCount = 0;

    getSecretRows(grid).forEach((row) => {
        const secretName = getValidSecretName(getSecretName(row, mode.nameColumnIndex));
        const matches = !secretName || !query || secretName.toLowerCase().includes(query);

        if (secretName) {
            totalCount += 1;
            if (matches) matchCount += 1;
        }

        const shouldHide = Boolean(secretName) && !matches;
        const isHidden = row.dataset.kvSearchHidden === "true";
        if (shouldHide === isHidden) return;

        if (shouldHide) {
            row.dataset.kvSearchHidden = "true";
            row.style.display = "none";
        } else {
            delete row.dataset.kvSearchHidden;
            row.style.display = "";
        }
    });

    updateSearchCount(query
        ? `${matchCount} of ${totalCount}`
        : `${totalCount} secret${totalCount === 1 ? "" : "s"}`);
}

function resetSortState() {
    sortDirection = "";
    sortRestorePending = false;
}

function handleSortHeaderClick(event) {
    if (event.target.closest?.(".azc-grid-resizableColumn-handle")) return;

    event.preventDefault();
    event.stopPropagation();

    if (sortDirection === "") {
        sortDirection = "asc";
    } else if (sortDirection === "asc") {
        sortDirection = "desc";
    } else {
        sortDirection = "";
        sortRestorePending = true;
    }

    scheduleProcessGrid();
}

function updateSortIndicator(headerCell) {
    let indicator = headerCell.querySelector(`.${SORT_INDICATOR_CLASS}`);

    if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = SORT_INDICATOR_CLASS;
        indicator.setAttribute("role", "presentation");
        indicator.style.cssText = "margin-left:4px;font-size:10px;line-height:1;flex:0 0 auto;";

        const label = headerCell.querySelector("[role='columnheader']");
        if (label) {
            label.insertAdjacentElement("afterend", indicator);
        } else {
            headerCell.appendChild(indicator);
        }
    }

    const arrow = sortDirection === "asc" ? "\u25B2" : sortDirection === "desc" ? "\u25BC" : "";
    if (indicator.textContent !== arrow) {
        indicator.textContent = arrow;
    }

    if (sortDirection) {
        headerCell.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
    } else {
        headerCell.removeAttribute("aria-sort");
    }
}

function ensureNameHeaderSort(grid, mode) {
    if (mode.type !== "secrets") return;

    const headerCell = getHeaderCells(grid)[mode.nameColumnIndex];
    if (!headerCell || headerCell.classList.contains(HEADER_CLASS)) return;

    if (headerCell.dataset.kvSortBound !== "true") {
        // Leave the portal's own sorting alone if the header is already sortable.
        const nativelySortable = headerCell.matches("[aria-sort], [class*='sortable']")
            || Boolean(headerCell.querySelector("[aria-sort], [class*='sortable']"));
        if (nativelySortable) return;

        headerCell.dataset.kvSortBound = "true";
        headerCell.style.cursor = "pointer";
        headerCell.title = "Sort by name";
        headerCell.addEventListener("click", handleSortHeaderClick);
    }

    updateSortIndicator(headerCell);
}

function captureOriginalRowOrder(rows) {
    let nextIndex = rows.reduce((max, row) => {
        const value = Number(row.dataset.kvOriginalIndex);
        return Number.isFinite(value) ? Math.max(max, value + 1) : max;
    }, 0);

    rows.forEach((row) => {
        if (!row.dataset.kvOriginalIndex) {
            row.dataset.kvOriginalIndex = String(nextIndex);
            nextIndex += 1;
        }
    });
}

function applySort(grid, mode) {
    if (mode.type !== "secrets") return;

    const allRows = getSecretRows(grid).filter((row) => getValidSecretName(getSecretName(row, mode.nameColumnIndex)));
    if (allRows.length === 0) return;

    const parent = allRows[0].parentElement;
    if (!parent) return;

    const rows = allRows.filter((row) => row.parentElement === parent);

    // Remember portal order before any reordering so the third header click can restore it.
    captureOriginalRowOrder(rows);

    if (!sortDirection && !sortRestorePending) return;

    const sorted = rows.slice().sort((a, b) => {
        if (!sortDirection) {
            return Number(a.dataset.kvOriginalIndex) - Number(b.dataset.kvOriginalIndex);
        }

        const comparison = getSecretName(a, mode.nameColumnIndex)
            .localeCompare(getSecretName(b, mode.nameColumnIndex), undefined, { numeric: true, sensitivity: "base" });
        return sortDirection === "desc" ? -comparison : comparison;
    });

    if (!sortDirection) {
        sortRestorePending = false;
    }

    if (sorted.every((row, index) => row === rows[index])) {
        return;
    }

    const marker = document.createTextNode("");
    parent.insertBefore(marker, rows[0]);
    sorted.forEach((row) => parent.insertBefore(row, marker));
    parent.removeChild(marker);
}

function renderSecretListRows(grid, vaultName, mode) {
    getSecretRows(grid).forEach((row) => {
        const secretName = getValidSecretName(getSecretName(row, mode.nameColumnIndex));
        if (!secretName) return;

        const content = ensureValueCell(row, mode.insertIndex);
        const targetState = isRevealed ? "revealed" : "hidden";

        if (
            row.dataset.kvVaultName === vaultName
            && row.dataset.kvSecretName === secretName
            && !row.dataset.kvSecretVersion
            && row.dataset.kvSecretState === targetState
        ) {
            return;
        }

        row.dataset.kvVaultName = vaultName;
        row.dataset.kvSecretName = secretName;
        delete row.dataset.kvSecretVersion;
        row.dataset.kvSecretState = targetState;

        if (!isRevealed) {
            renderHidden(content);
            return;
        }

        const generationAtFetch = renderGeneration;
        content.textContent = "Fetching...";
        content.title = "";
        content.style.color = "#d13438";

        const rowStillCurrent = () => (
            generationAtFetch === renderGeneration
            && isRevealed
            && row.dataset.kvVaultName === vaultName
            && row.dataset.kvSecretName === secretName
            && !row.dataset.kvSecretVersion
            && row.dataset.kvSecretState === "revealed"
        );

        fetchSecretValue(vaultName, secretName).then((result) => {
            if (!rowStillCurrent()) {
                return;
            }

            if (!Object.prototype.hasOwnProperty.call(result, "value")) {
                const displayError = `[${result.error || "Error fetching secret"}]`;
                content.textContent = displayError;
                content.title = displayError;
                content.style.color = "#a4262c";
                return;
            }

            renderEditableSecretValue(content, {
                vaultName,
                secretName,
                value: result.value,
                isCurrent: rowStillCurrent,
                onSaved: () => {
                    if (!rowStillCurrent()) return;
                    row.dataset.kvSecretState = "saved";
                    scheduleProcessGrid();
                }
            });
        });
    });
}

function getVersionRowGroup(row) {
    let currentRow = row.previousElementSibling;

    while (currentRow) {
        const text = normalizeHeaderText(currentRow.textContent || "");

        if (text.includes("older versions")) {
            return "older";
        }

        if (text.includes("current version")) {
            return "current";
        }

        currentRow = currentRow.previousElementSibling;
    }

    return "";
}

function renderSecretVersionRows(grid, vaultName, mode) {
    let hasSeenVersionRow = false;

    getSecretRows(grid).forEach((row) => {
        const secretReference = getVersionRowSecretReference(row, mode);
        if (!secretReference) return;

        const { secretName, version } = secretReference;
        const group = getVersionRowGroup(row);
        const isEditableVersion = group === "current" || (!group && !hasSeenVersionRow);
        hasSeenVersionRow = true;

        const valueContent = ensureInjectedCell(row, VALUE_COLUMN, mode.insertIndex);
        const createdContent = ensureInjectedCell(row, CREATED_DATE_COLUMN, mode.insertIndex + 1);
        const targetState = isRevealed ? "revealed" : "hidden";
        const targetEditable = isEditableVersion ? "true" : "false";

        if (
            row.dataset.kvVaultName === vaultName
            && row.dataset.kvSecretName === secretName
            && row.dataset.kvSecretVersion === version
            && row.dataset.kvSecretState === targetState
            && row.dataset.kvSecretEditable === targetEditable
        ) {
            return;
        }

        row.dataset.kvVaultName = vaultName;
        row.dataset.kvSecretName = secretName;
        row.dataset.kvSecretVersion = version;
        row.dataset.kvSecretState = targetState;
        row.dataset.kvSecretEditable = targetEditable;

        if (!isRevealed) {
            renderHidden(valueContent);
            renderEmpty(createdContent);
            return;
        }

        const generationAtFetch = renderGeneration;
        valueContent.textContent = "Fetching...";
        valueContent.title = "";
        valueContent.style.color = "#d13438";
        createdContent.textContent = "Fetching...";
        createdContent.title = "";
        createdContent.style.color = "";

        const rowStillCurrent = () => (
            generationAtFetch === renderGeneration
            && isRevealed
            && row.dataset.kvVaultName === vaultName
            && row.dataset.kvSecretName === secretName
            && row.dataset.kvSecretVersion === version
            && row.dataset.kvSecretState === "revealed"
            && row.dataset.kvSecretEditable === targetEditable
        );

        fetchSecretValue(vaultName, secretName, version).then((result) => {
            if (!rowStillCurrent()) {
                return;
            }

            if (!Object.prototype.hasOwnProperty.call(result, "value")) {
                const displayError = `[${result.error || "Error fetching secret"}]`;
                valueContent.textContent = displayError;
                valueContent.title = displayError;
                valueContent.style.color = "#a4262c";
                createdContent.textContent = displayError;
                createdContent.title = displayError;
                createdContent.style.color = "#a4262c";
                return;
            }

            const displayValue = result.value;
            const createdDate = formatCreatedDate(result.created);

            if (isEditableVersion) {
                renderEditableSecretValue(valueContent, {
                    vaultName,
                    secretName,
                    value: displayValue,
                    isCurrent: rowStillCurrent,
                    onSaved: () => {
                        if (!rowStillCurrent()) return;
                        row.dataset.kvSecretState = "saved";
                        scheduleProcessGrid();
                    }
                });
            } else {
                renderReadonlySecretValue(valueContent, displayValue, "Older version read-only");
            }

            createdContent.textContent = createdDate;
            createdContent.title = createdDate;
            createdContent.style.color = "";
        });
    });
}

function renderRows(grid, vaultName, mode) {
    prepareGridForMode(grid, mode);

    if (mode.type === "versions") {
        renderSecretVersionRows(grid, vaultName, mode);
        return;
    }

    renderSecretListRows(grid, vaultName, mode);
}

function processGrid() {
    processTimer = null;

    const pageKey = `${window.location.href}|${document.title}`;
    if (pageKey !== lastPageKey) {
        lastPageKey = pageKey;
        renderGeneration += 1;
        pendingFetches.clear();

        // A visited versions view may have changed the secret (inline edit or the
        // portal's own "New Version" flow), so drop its cached values on the way out.
        if (lastVersionsContext) {
            clearSecretCache(lastVersionsContext.vaultName, lastVersionsContext.secretName);
            lastVersionsContext = null;
        }

        document.querySelectorAll('[role="grid"][data-kv-original-colcount]').forEach(cleanupInjectedGrid);
        resetRowState();
        resetAutoLoadState();
        resetSearchState();
        resetSortState();
        removeCreateSecretUi();
        removeImportExportUi();
    }

    const vaultName = getVaultNameFromPage();
    const grid = findSecretsGrid();

    if (!vaultName || !grid) {
        removeToggleButton();
        removeSearchBar();
        removeCreateSecretUi();
        removeImportExportUi();
        document.querySelectorAll('[role="grid"][data-kv-original-colcount]').forEach(cleanupInjectedGrid);
        return;
    }

    injectToggleButton();
    autoClickLoadMore(grid);
    restoreAutoLoadScroll();

    const mode = getGridMode(grid);

    if (mode.type === "versions") {
        lastVersionsContext = { vaultName, secretName: mode.secretName };
    }

    renderRows(grid, vaultName, mode);

    if (mode.type === "secrets") {
        injectCreateSecretButton();
        injectImportExportButtons();
        ensureCreateSecretPanel();
        ensureSearchBar(grid, mode);
        ensureNameHeaderSort(grid, mode);
        applySort(grid, mode);
        applySearchFilter(grid, mode);
    } else {
        removeSearchBar();
        removeCreateSecretUi();
        removeImportExportUi();
    }
}

function scheduleProcessGrid() {
    if (processTimer !== null) return;
    processTimer = window.setTimeout(processGrid, 100);
}

const observer = new MutationObserver(scheduleProcessGrid);
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener("hashchange", scheduleProcessGrid);
window.addEventListener("popstate", scheduleProcessGrid);

scheduleProcessGrid();
window.setInterval(scheduleProcessGrid, 1500);