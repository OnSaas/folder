import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../../utils/storage-secret";
import { sanitizeObjectPath, assertMountPath, pathToId, idToPath } from "../../utils/object-path";
import { S3Driver } from "./s3";
import { toPublicStorage } from "../../utils/storages";
import { SCHEMA_VERSION } from "../types";

describe("storage secrets", () => {
  it("round-trips encryption", async () => {
    process.env.NUXT_STORAGE_SECRET = "x".repeat(32);
    const packed = await encryptSecret("hello-secret");
    assert.match(packed, /^v1\./);
    assert.equal(await decryptSecret(packed), "hello-secret");
    await assert.rejects(() => decryptSecret(packed, "y".repeat(32)));
  });
});

describe("object path", () => {
  it("rejects traversal", () => {
    assert.equal(sanitizeObjectPath("a/b"), "a/b");
    assert.throws(() => sanitizeObjectPath("../etc/passwd"));
    assert.throws(() => sanitizeObjectPath("a/%2e%2e/b"));
    assert.equal(assertMountPath("b2-backup"), "b2-backup");
    assert.throws(() => assertMountPath("Primary"));
    const id = pathToId("docs/a.txt");
    assert.equal(idToPath(id), "docs/a.txt");
  });
});

describe("public storage payload", () => {
  it("never includes secret", () => {
    const pub = toPublicStorage({
      schemaVersion: SCHEMA_VERSION,
      id: "s1",
      name: "B2",
      type: "s3",
      mountPath: "b2",
      readOnly: false,
      config: { endpoint: "https://s3.us-west-000.backblazeb2.com" },
      secret: "v1.should-not-leak",
      status: "ok",
      createdAt: 1,
      updatedAt: 1,
    });
    assert.equal(pub.hasSecret, true);
    assert.equal(JSON.stringify(pub).includes("v1.should-not-leak"), false);
    assert.equal((pub as any).secret, undefined);
  });
});

describe("S3 driver", () => {
  it("signs requests and parses delimiter listings", async () => {
    const calls: Request[] = [];
    const xml = `<?xml version="1.0"?>
<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>docs/a.txt</Key><Size>12</Size><LastModified>2026-01-01T00:00:00.000Z</LastModified><ETag>"abc"</ETag></Contents>
  <CommonPrefixes><Prefix>docs/sub/</Prefix></CommonPrefixes>
</ListBucketResult>`;
    const fetchImpl = async (input: Request | string) => {
      const req = typeof input === "string" ? new Request(input) : input;
      calls.push(req);
      return new Response(xml, { status: 200, headers: { "content-type": "application/xml" } });
    };
    const driver = new S3Driver(
      "s3",
      {
        endpoint: "https://s3.us-west-000.backblazeb2.com",
        region: "us-west-000",
        bucket: "my-bucket",
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        forcePathStyle: true,
      },
      fetchImpl as typeof fetch
    );
    const listed = await driver.list("docs");
    assert.equal(listed.items.length, 2);
    assert.equal(listed.items[0].path, "docs/a.txt");
    assert.equal(listed.items[1].isDir, true);
    assert.ok(calls[0].headers.get("authorization")?.includes("AWS4-HMAC-SHA256"));
    assert.match(calls[0].url, /delimiter=%2F|delimiter=\//);
  });
});
