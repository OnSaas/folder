import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryDriver } from "./memory";
import { R2Driver, type BlobBackend } from "./r2";
import { trashObjectKey } from "./types";
import type { StorageDriver } from "./types";

async function readAll(stream: ReadableStream) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const size = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}

async function runContract(driver: StorageDriver) {
  const path = "files/hello.txt";
  const body = new TextEncoder().encode("hello world");
  await driver.put(path, body.buffer, { contentType: "text/plain", size: body.byteLength });
  const head = await driver.head(path);
  assert.equal(head?.size, body.byteLength);
  assert.equal(head?.contentType, "text/plain");
  const got = await driver.get(path);
  assert.ok(got);
  assert.equal(await readAll(got.body), "hello world");
  if (driver.caps.copy) {
    await driver.copy!(path, "files/copy.txt");
    const copy = await driver.get("files/copy.txt");
    assert.equal(await readAll(copy!.body), "hello world");
  }
  if (driver.caps.move) {
    await driver.move!(path, "files/moved.txt");
    assert.equal(await driver.head(path), null);
    const moved = await driver.get("files/moved.txt");
    assert.equal(await readAll(moved!.body), "hello world");
    await driver.delete("files/moved.txt");
  } else {
    await driver.delete(path);
  }
  assert.equal(await driver.head(path), null);
  const probe = await driver.test();
  assert.equal(probe.ok, true);
}

function fakeBlob(): BlobBackend {
  const store = new Map<string, { data: Uint8Array; contentType?: string }>();
  return {
    async get(path) {
      const entry = store.get(path);
      return entry ? entry.data : null;
    },
    async put(path, body, opts) {
      let data: Uint8Array;
      if (body instanceof Uint8Array) data = body;
      else if (body instanceof ArrayBuffer) data = new Uint8Array(body);
      else if (typeof Blob !== "undefined" && body instanceof Blob) {
        data = new Uint8Array(await body.arrayBuffer());
      } else {
        data = new TextEncoder().encode(String(body ?? ""));
      }
      store.set(path, { data, contentType: opts?.contentType });
    },
    async del(path) {
      store.delete(path);
    },
    async head(path) {
      const entry = store.get(path);
      if (!entry) return null;
      return {
        contentType: entry.contentType,
        size: entry.data.byteLength,
        httpEtag: `"${entry.data.byteLength}"`,
        uploadedAt: new Date(),
      };
    },
  };
}

describe("driver contract", () => {
  it("covers MemoryDriver", async () => {
    await runContract(new MemoryDriver());
  });

  it("covers R2Driver with a fake blob backend", async () => {
    await runContract(new R2Driver("primary", fakeBlob()));
  });

  it("builds the live trash object key format", () => {
    const at = Date.parse("2026-01-02T03:04:05.000Z");
    assert.equal(
      trashObjectKey("box/docs/a.txt", at),
      ".trash/box/2026-01-02T03:04:05.000Z/box/docs/a.txt"
    );
  });
});
