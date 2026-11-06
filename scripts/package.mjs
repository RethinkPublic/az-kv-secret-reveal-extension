#!/usr/bin/env node
// Builds the Chrome Web Store upload ZIP: dist/az-kv-secret-revealer-<version>.zip
// Usage: node scripts/package.mjs
// No dependencies. The packaged manifest has no "key" field, which the store rejects.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

// Allowlist: only files the extension loads at runtime go into the ZIP.
const RUNTIME_FILES = [
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png"
];

const STORE_FORBIDDEN_KEYS = ["key", "update_url"];

function fail(message) {
    console.error(`package: ${message}`);
    process.exit(1);
}

function manifestReferencedFiles(manifest) {
    const files = new Set();
    const addAll = (values) => values?.forEach((value) => value && files.add(value));
    addAll(Object.values(manifest.icons ?? {}));
    addAll(Object.values(manifest.action?.default_icon ?? {}));
    addAll([manifest.action?.default_popup, manifest.background?.service_worker]);
    for (const script of manifest.content_scripts ?? []) {
        addAll(script.js);
        addAll(script.css);
    }
    return files;
}

function buildStoreManifest() {
    const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));

    for (const field of STORE_FORBIDDEN_KEYS) {
        delete manifest[field];
    }

    if (!/^\d{1,9}(\.\d{1,9}){0,3}$/.test(manifest.version ?? "")) {
        fail(`manifest version "${manifest.version}" must be 1-4 dot-separated integers`);
    }
    if ((manifest.name ?? "").length > 75) {
        fail("manifest name is longer than 75 characters");
    }
    if ((manifest.description ?? "").length > 132) {
        fail("manifest description is longer than 132 characters");
    }
    for (const file of manifestReferencedFiles(manifest)) {
        if (!RUNTIME_FILES.includes(file)) {
            fail(`manifest references "${file}", which is not in RUNTIME_FILES`);
        }
    }

    return manifest;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

// Fixed 1980-01-01 00:00 timestamp keeps the ZIP byte-identical across builds.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

function createZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const { name, data } of entries) {
        const nameBytes = Buffer.from(name, "utf8");
        const compressed = deflateRawSync(data, { level: 9 });
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBytes.length, 26);
        local.writeUInt16LE(0, 28);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBytes.length, 28);
        central.writeUInt32LE(offset, 42);

        localParts.push(local, nameBytes, compressed);
        centralParts.push(central, nameBytes);
        offset += local.length + nameBytes.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

const manifest = buildStoreManifest();
const entries = [{ name: "manifest.json", data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8") }];

for (const file of RUNTIME_FILES) {
    const path = join(ROOT, file);
    if (!existsSync(path)) {
        fail(`missing runtime file ${file}`);
    }
    entries.push({ name: file, data: readFileSync(path) });
}

mkdirSync(DIST, { recursive: true });
const zipPath = join(DIST, `az-kv-secret-revealer-${manifest.version}.zip`);
writeFileSync(zipPath, createZip(entries));

console.log(`Wrote ${zipPath}`);
for (const { name, data } of entries) {
    console.log(`  ${String(data.length).padStart(7)}  ${name}`);
}
