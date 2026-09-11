#!/usr/bin/env node
/**
 * EdgeNux Worker deploy for OnSaas/folder (Nuxt cloudflare_module).
 * Nitro 2.11 emits `_EventEmitter` after `_Readable extends _EventEmitter`.
 * Patch to `node:events` then wrangler --no-bundle from dist/server.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("npm", ["run", "build"]);

const nitroPath = join(root, "dist/server/chunks/nitro/nitro.mjs");
let nitro = readFileSync(nitroPath, "utf8");
if (!nitro.includes('from "node:events"')) {
  nitro = 'import { EventEmitter as _EventEmitter } from "node:events";' + nitro;
}
nitro = nitro.replace("class _EventEmitter{", "class _UnusedEventEmitter{");
writeFileSync(nitroPath, nitro);

const wranglerSrc = join(root, "wrangler.jsonc");
const wranglerDst = join(root, "dist/server/wrangler.jsonc");
const src = JSON.parse(
  readFileSync(wranglerSrc, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")
);
const out = {
  name: src.name,
  account_id: src.account_id,
  main: "index.mjs",
  compatibility_date: src.compatibility_date,
  compatibility_flags: src.compatibility_flags || ["nodejs_compat"],
  no_bundle: true,
  find_additional_modules: true,
  base_dir: ".",
  rules: [{ type: "ESModule", globs: ["**/*.mjs"], fallthrough: true }],
  observability: src.observability || { enabled: true },
  kv_namespaces: src.kv_namespaces,
  r2_buckets: src.r2_buckets,
  assets: { binding: "ASSETS", directory: "../public" },
};
writeFileSync(wranglerDst, JSON.stringify(out, null, 2) + "\n");

if (src.account_id) process.env.CLOUDFLARE_ACCOUNT_ID = src.account_id;
run("npx", ["wrangler", "deploy", "--keep-vars"], join(root, "dist/server"));
