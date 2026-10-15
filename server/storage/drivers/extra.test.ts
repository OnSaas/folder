import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePropfind, WebDavDriver } from "./webdav";
import { OneDriveDriver } from "./onedrive";
import { GDriveDriver } from "./gdrive";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textRes(body: string, status = 200, headers: Record<string, string> = {}) {
  if (status === 204 || status === 205) return new Response(null, { status, headers });
  return new Response(body, { status, headers });
}

describe("webdav propfind parser", () => {
  it("skips self and maps children", () => {
    const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/user/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/user/notes.txt</d:href>
    <d:propstat><d:prop>
      <d:getcontentlength>4</d:getcontentlength>
      <d:getcontenttype>text/plain</d:getcontenttype>
      <d:getlastmodified>Wed, 01 Jan 2026 00:00:00 GMT</d:getlastmodified>
    </d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/user/docs/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
</d:multistatus>`;
    const items = parsePropfind(xml, "https://dav.test/remote.php/dav/files/user/");
    assert.equal(items.length, 2);
    assert.equal(items.find((item) => item.path === "notes.txt")?.size, 4);
    assert.equal(items.find((item) => item.path === "docs")?.isDir, true);
  });
});

describe("webdav driver", () => {
  it("puts gets copies and deletes over a mock server", async () => {
    const store = new Map<string, { bytes: Uint8Array; type: string }>();
    const fetchImpl: typeof fetch = async (input, init) => {
      const req = new Request(input, init);
      const url = new URL(req.url);
      const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (req.method === "PUT") {
        const bytes = new Uint8Array(await req.arrayBuffer());
        store.set(path, { bytes, type: req.headers.get("content-type") || "application/octet-stream" });
        return textRes("", 201);
      }
      if (req.method === "HEAD") {
        const entry = store.get(path);
        if (!entry) return textRes("", 404);
        return textRes("", 200, {
          "content-length": String(entry.bytes.byteLength),
          "content-type": entry.type,
        });
      }
      if (req.method === "GET") {
        const entry = store.get(path);
        if (!entry) return textRes("", 404);
        return new Response(entry.bytes as BodyInit, { headers: { "content-type": entry.type } });
      }
      if (req.method === "DELETE") {
        store.delete(path);
        return textRes("", 204);
      }
      if (req.method === "COPY" || req.method === "MOVE") {
        const dest = new URL(req.headers.get("destination") || "", url).pathname.replace(/^\/+/, "");
        const entry = store.get(path);
        if (!entry) return textRes("", 404);
        store.set(decodeURIComponent(dest), { ...entry, bytes: new Uint8Array(entry.bytes) });
        if (req.method === "MOVE") store.delete(path);
        return textRes("", 201);
      }
      return textRes("no", 405);
    };
    const driver = new WebDavDriver(
      "dav",
      { endpoint: "https://dav.test", username: "u", password: "p" },
      fetchImpl
    );
    await driver.put("files/hello.txt", new TextEncoder().encode("hello world"), {
      contentType: "text/plain",
      size: 11,
    });
    const got = await driver.get("files/hello.txt");
    assert.ok(got);
    const text = new TextDecoder().decode(new Uint8Array(await new Response(got.body).arrayBuffer()));
    assert.equal(text, "hello world");
    await driver.copy!("files/hello.txt", "files/copy.txt");
    assert.ok(await driver.head("files/copy.txt"));
    await driver.delete("files/hello.txt");
    assert.equal(await driver.head("files/hello.txt"), null);
    const probe = await driver.test();
    assert.equal(probe.ok, true);
  });
});

describe("onedrive driver", () => {
  it("refreshes a token then uploads and lists", async () => {
    const files = new Map<string, { name: string; content: Uint8Array }>();
    const fetchImpl: typeof fetch = async (input, init) => {
      const req = new Request(input, init);
      const url = new URL(req.url);
      if (url.hostname === "login.microsoftonline.com") {
        return jsonRes({ access_token: "tok", expires_in: 3600 });
      }
      if (!req.headers.get("authorization")?.includes("tok")) return jsonRes({ error: "auth" }, 401);
      const marker = url.pathname.split("/root:/")[1] || "";
      const itemPath = decodeURIComponent(marker.replace(/:\/content$/, "").replace(/:\/children$/, ""));
      if (url.pathname.endsWith("/children") || marker.endsWith(":/children")) {
        return jsonRes({
          value: [...files.values()].map((file) => ({
            name: file.name,
            size: file.content.byteLength,
            file: { mimeType: "text/plain" },
          })),
        });
      }
      if (req.method === "PUT") {
        const bytes = new Uint8Array(await req.arrayBuffer());
        const name = itemPath.split("/").pop() || itemPath;
        files.set(itemPath, { name, content: bytes });
        return jsonRes({ name, size: bytes.byteLength, file: { mimeType: "text/plain" } });
      }
      if (req.method === "GET" && marker.includes(":/content")) {
        const entry = files.get(itemPath);
        if (!entry) return jsonRes({}, 404);
        return new Response(entry.content as BodyInit);
      }
      if (req.method === "GET") {
        const entry = files.get(itemPath);
        if (!entry) return jsonRes({}, 404);
        return jsonRes({ name: entry.name, size: entry.content.byteLength, file: { mimeType: "text/plain" } });
      }
      if (req.method === "DELETE") {
        files.delete(itemPath);
        return textRes("", 204);
      }
      return jsonRes({}, 404);
    };
    const driver = new OneDriveDriver(
      "od",
      { clientId: "id", clientSecret: "sec", refreshToken: "ref" },
      fetchImpl
    );
    await driver.put("hello.txt", new TextEncoder().encode("hi"), { contentType: "text/plain", size: 2 });
    const listed = await driver.list!("");
    assert.equal(listed.items[0]?.path, "hello.txt");
    const probe = await driver.test();
    assert.equal(probe.ok, true);
  });
});

describe("gdrive driver", () => {
  it("creates a file through the Drive API mock", async () => {
    const files: { id: string; name: string; parents: string[]; mimeType: string; content?: Uint8Array }[] = [
      { id: "root", name: "My Drive", parents: [], mimeType: "application/vnd.google-apps.folder" },
    ];
    let seq = 1;
    const fetchImpl: typeof fetch = async (input, init) => {
      const req = new Request(input, init);
      const url = new URL(req.url);
      if (url.hostname === "oauth2.googleapis.com") {
        return jsonRes({ access_token: "gtok", expires_in: 3600 });
      }
      if (req.method === "GET" && url.searchParams.has("q")) {
        const q = url.searchParams.get("q") || "";
        const parent = q.match(/'([^']+)' in parents/)?.[1];
        const name = q.match(/name = '([^']+)'/)?.[1];
        const matched = files.filter(
          (file) => (!parent || file.parents.includes(parent)) && (!name || file.name === name) && file.id !== "root"
        );
        return jsonRes({ files: matched.map(({ content, ...rest }) => rest) });
      }
      if (req.method === "POST" && url.pathname === "/drive/v3/files") {
        const body = (await req.json()) as { name: string; parents?: string[]; mimeType?: string };
        const id = `id${seq++}`;
        files.push({
          id,
          name: body.name,
          parents: body.parents || ["root"],
          mimeType: body.mimeType || "application/octet-stream",
        });
        return jsonRes({ id, name: body.name, mimeType: body.mimeType });
      }
      if (req.method === "PATCH" && url.pathname.includes("/files/")) {
        const id = url.pathname.split("/files/")[1];
        const file = files.find((item) => item.id === id);
        if (!file) return jsonRes({}, 404);
        file.content = new Uint8Array(await req.arrayBuffer());
        return jsonRes({ id, name: file.name, mimeType: file.mimeType, size: String(file.content.byteLength) });
      }
      if (req.method === "DELETE") {
        const id = url.pathname.split("/files/")[1];
        const index = files.findIndex((item) => item.id === id);
        if (index >= 0) files.splice(index, 1);
        return textRes("", 204);
      }
      return jsonRes({}, 404);
    };
    const driver = new GDriveDriver(
      "gd",
      { clientId: "id", clientSecret: "sec", refreshToken: "ref" },
      fetchImpl
    );
    const meta = await driver.put("notes.txt", new TextEncoder().encode("hi"), {
      contentType: "text/plain",
      size: 2,
    });
    assert.equal(meta.path, "notes.txt");
    const probe = await driver.test();
    assert.equal(probe.ok, true);
  });
});
