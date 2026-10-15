import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryKv } from "../memory";
import { setKvOverride } from "../kv";
import { MemoryDriver } from "./memory";
import {
  clearDriverCache,
  getDriver,
  setDriverOverride,
} from ".";
import { fileRepository } from "../../repositories/file";
import { userRepository } from "../../repositories/user";
import { bucketRepository } from "../../repositories/bucket";
import { keys } from "../keys";
import { setJson } from "../kv";
import { serveObject } from "./serve";

// Minimal Nitro stubs: the S1 acceptance test runs the real serve path against
// a MemoryDriver, so it needs the same globals the other handler tests install.
function installGlobals() {
  const g = globalThis as any;
  g.defineEventHandler = (fn: any) => fn;
  g.createError = (opts: any) => {
    const err: any = new Error(opts?.message || "error");
    err.statusCode = opts?.status;
    err.status = opts?.status;
    return err;
  };
}

installGlobals();

// blob.ts reports failures through the request-scoped translator.
(globalThis as any).useEvent = () => ({
  headers: new Headers(),
  path: "/",
});
(globalThis as any).getCookie = () => undefined;

const kv = new MemoryKv();
setKvOverride(kv);

function makeEvent(init: {
  headers?: Record<string, string>;
  path?: string;
} = {}) {
  const headers = new Headers(init.headers || {});
  const res = {
    status: 200,
    headers: {} as Record<string, string>,
  };
  const event: any = {
    headers,
    path: init.path || "/",
    node: { res },
    status: 200,
    $status: 200,
    respond: undefined,
  };
  return event;
}

function installServeGlobals() {
  const g = globalThis as any;
  g.getHeader = (event: any, name: string) =>
    event.headers.get(name) ?? event.headers.get(name.toLowerCase()) ?? undefined;
  g.setHeader = (event: any, name: string, value: string) => {
    event.headers_set = event.headers_set || {};
    event.headers_set[name] = value;
  };
  g.setResponseStatus = (event: any, status: number) => {
    event.status = status;
  };
  g.sendStream = (event: any, stream: any) => {
    event.stream = stream;
    return stream;
  };
}

installServeGlobals();

async function readStream(stream: ReadableStream) {
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

describe("S1 acceptance: driver-backed object serving", () => {
  const primary = new MemoryDriver("primary");

  before(async () => {
    clearDriverCache();
    setDriverOverride("primary", primary);
    await setJson(keys.owner(), "owner");
    await userRepository.create({ id: "owner", name: "Owner", createdAt: 1 });
    await bucketRepository.create({
      id: "bkt",
      name: "box",
      userId: "owner",
      size: 0,
      count: 0,
      createdAt: 1,
      updatedAt: 1,
    });
  });

  it("serves a non-R2 driver object with type, length and ETag", async () => {
    const body = new TextEncoder().encode("hello world");
    await primary.put("box/docs/a.txt", body, { contentType: "text/plain", size: body.byteLength });

    const event = makeEvent({ path: "/preview/box/docs/a.txt" });
    const stream = await serveObject(event, getDriver("primary"), "box/docs/a.txt");
    assert.equal(event.status, 200);
    assert.equal(event.headers_set["Content-Type"], "text/plain");
    assert.equal(event.headers_set["Content-Length"], String(body.byteLength));
    assert.ok(event.headers_set["ETag"]);
    assert.equal(await readStream(stream), "hello world");
  });

  it("honours If-None-Match with 304 and no body", async () => {
    const body = new TextEncoder().encode("cached");
    await primary.put("box/docs/b.txt", body, { contentType: "text/plain", size: body.byteLength });
    const meta = await primary.head("box/docs/b.txt");

    const event = makeEvent({
      path: "/preview/box/docs/b.txt",
      headers: { "if-none-match": meta!.etag! },
    });
    const out = await serveObject(event, getDriver("primary"), "box/docs/b.txt");
    assert.equal(event.status, 304);
    assert.equal(out, "");
  });

  it("serves a byte range as 206 with Content-Range", async () => {
    const body = new TextEncoder().encode("0123456789");
    await primary.put("box/docs/c.txt", body, { contentType: "text/plain", size: body.byteLength });

    const event = makeEvent({
      path: "/preview/box/docs/c.txt",
      headers: { range: "bytes=2-5" },
    });
    const stream = await serveObject(event, getDriver("primary"), "box/docs/c.txt");
    assert.equal(event.status, 206);
    assert.equal(event.headers_set["Content-Range"], "bytes 2-5/10");
    assert.equal(event.headers_set["Content-Length"], "4");
    assert.equal(await readStream(stream), "2345");
  });

  it("sets Content-Disposition for downloads", async () => {
    const body = new TextEncoder().encode("dl");
    await primary.put("box/docs/d.txt", body, { contentType: "text/plain", size: body.byteLength });

    const event = makeEvent({ path: "/api/files/box/download/x" });
    await serveObject(event, getDriver("primary"), "box/docs/d.txt", {
      downloadName: "d.txt",
    });
    assert.match(event.headers_set["Content-Disposition"], /^attachment; filename=/);
  });

  it("404s a missing object", async () => {
    const event = makeEvent({ path: "/preview/box/nope.txt" });
    await assert.rejects(
      serveObject(event, getDriver("primary"), "box/nope.txt"),
      (err: any) => err.statusCode === 404
    );
  });

  it("keeps trash keys pointing at the moved object", async () => {
    const body = new TextEncoder().encode("trashed");
    await primary.put("box/docs/e.txt", body, { contentType: "text/plain", size: body.byteLength });
    const deletedAt = Date.parse("2026-01-02T03:04:05.000Z");
    const { trashObjectKey } = await import("./types");
    const trashKey = trashObjectKey("box/docs/e.txt", deletedAt);

    await primary.move("box/docs/e.txt", trashKey);
    assert.equal(await primary.head("box/docs/e.txt"), null);

    const event = makeEvent({ path: "/preview/box/docs/e.txt" });
    const stream = await serveObject(event, getDriver("primary"), trashKey);
    assert.equal(await readStream(stream), "trashed");
  });
});

describe("S1 acceptance: blob helpers stay behavior-identical", () => {
  const primary = new MemoryDriver("primary");

  before(() => {
    clearDriverCache();
    setDriverOverride("primary", primary);
  });

  it("moveBlob relocates an object", async () => {
    const { moveBlob } = await import("../../utils/blob");
    await primary.put("box/m.txt", new TextEncoder().encode("m"), {
      contentType: "text/plain",
      size: 1,
    });
    await moveBlob("box/m.txt", "box/docs/m.txt");
    assert.equal(await primary.head("box/m.txt"), null);
    assert.ok(await primary.head("box/docs/m.txt"));
  });

  it("copyBlob keeps the source", async () => {
    const { copyBlob } = await import("../../utils/blob");
    await primary.put("box/c.txt", new TextEncoder().encode("c"), {
      contentType: "text/plain",
      size: 1,
    });
    await copyBlob("box/c.txt", "box/docs/c.txt");
    assert.ok(await primary.head("box/c.txt"));
    assert.ok(await primary.head("box/docs/c.txt"));
  });

  it("deleteBlob moves the object to the .trash key it returns", async () => {
    const { deleteBlob } = await import("../../utils/blob");
    const { trashObjectKey } = await import("./types");
    await primary.put("box/d.txt", new TextEncoder().encode("d"), {
      contentType: "text/plain",
      size: 1,
    });
    const at = Date.parse("2026-03-04T05:06:07.000Z");
    await deleteBlob("box/d.txt", at);
    assert.equal(await primary.head("box/d.txt"), null);
    assert.ok(await primary.head(trashObjectKey("box/d.txt", at)));
  });
});

describe("S1 acceptance: file records carry storageId and trashKey", () => {
  beforeEach(() => {
    kv.store.clear();
  });

  it("defaults storageId to primary and persists trashKey", async () => {
    const now = Date.now();
    const record = await fileRepository.create({
      id: "f1",
      name: "a.txt",
      contentType: "text/plain",
      type: "document",
      size: 3,
      path: "box/a.txt",
      visibility: "private",
      count: 0,
      parentId: "root",
      bucketName: "box",
      userId: "owner",
      sharedCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      storageId: "primary",
      trashKey: null,
    });
    assert.equal(record.storageId, "primary");

    const trashed = await fileRepository.update(
      { ...record, deletedAt: now, trashKey: ".trash/box/2026-01-02T03:04:05.000Z/box/a.txt" },
      record
    );
    assert.equal(trashed.trashKey, ".trash/box/2026-01-02T03:04:05.000Z/box/a.txt");
    assert.equal(trashed.deletedAt, now);
  });
});
