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

let isRevealed = false;
let renderGeneration = 0;
let lastPageKey = "";
let processTimer = null;
let secretCache = new Map();
let pendingFetches = new Map();
let secretCacheRevision = 0;
let secretValueWidthPx = DEFAULT_SECRET_VALUE_WIDTH_PX;

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

    if (iconElement && iconElement.innerHTML !== icon) {
        iconElement.innerHTML = icon;
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

    delete grid.dataset.kvGridMode;
}

function getSecretCacheKey(vaultName, secretName, version = "") {
    return `${vaultName}/${secretName}/${version || "current"}`;
}

function clearSecretCache(vaultName, secretName) {
    const cacheKeyPrefix = `${vaultName}/${secretName}/`;
    secretCacheRevision += 1;

    Array.from(secretCache.keys()).forEach((cacheKey) => {
        if (cacheKey.startsWith(cacheKeyPrefix)) {
            secretCache.delete(cacheKey);
        }
    });

    Array.from(pendingFetches.keys()).forEach((cacheKey) => {
        if (cacheKey.startsWith(cacheKeyPrefix)) {
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

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.title = "Create new secret version";
    saveButton.setAttribute("aria-label", "Create new secret version");
    saveButton.innerHTML = SAVE_SECRET_ICON_SVG;
    saveButton.style.cssText = [
        "position:absolute",
        "right:2px",
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

    [wrapper, input, saveButton].forEach((element) => {
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

    inputWrapper.append(input, saveButton);
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
        "padding:1px 6px",
        "border:1px solid rgba(128,128,128,.22)",
        "border-radius:3px",
        "background:rgba(128,128,128,.04)",
        "color:#605e5c",
        "font:inherit",
        "font-family:monospace",
        "overflow:hidden",
        "text-overflow:ellipsis"
    ].join(";");

    [wrapper, input].forEach((element) => {
        ["click", "dblclick", "mousedown", "pointerdown", "keydown"].forEach((eventName) => {
            element.addEventListener(eventName, (event) => {
                event.stopPropagation();
            });
        });
    });

    wrapper.append(input);
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

function renderRows(grid, vaultName) {
    const mode = getGridMode(grid);
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
        document.querySelectorAll('[role="grid"][data-kv-original-colcount]').forEach(cleanupInjectedGrid);
        resetRowState();
    }

    const vaultName = getVaultNameFromPage();
    const grid = findSecretsGrid();

    if (!vaultName || !grid) {
        removeToggleButton();
        document.querySelectorAll('[role="grid"][data-kv-original-colcount]').forEach(cleanupInjectedGrid);
        return;
    }

    injectToggleButton();
    renderRows(grid, vaultName);
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