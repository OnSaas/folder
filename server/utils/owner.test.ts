import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryKv } from "../storage/memory";
import { setKvOverride } from "../storage/kv";
import { bucketRepository } from "../repositories/bucket";
import { userRepository } from "../repositories/user";
import { ensureOwnerAndBucket } from "./owner";
import { keys } from "../storage/keys";
import { delKey } from "../storage/kv";

describe("owner and bucket bootstrap", () => {
  const kv = new MemoryKv();
  setKvOverride(kv);

  beforeEach(() => {
    kv.store.clear();
    process.env.NUXT_BUCKET_NAME = "files";
  });

  it("creates a default bucket when the store is empty", async () => {
    const { bucket } = await ensureOwnerAndBucket();
    assert.equal(bucket.name, "files");
    assert.equal(bucket.userId, "owner");
  });

  it("reuses the single existing bucket", async () => {
    const now = Date.now();
    await bucketRepository.create({
      id: "b-old",
      name: "box",
      userId: "old-user-1",
      size: 1,
      count: 0,
      createdAt: now,
      updatedAt: now,
    });
    await userRepository.create({
      id: "old-user-1",
      name: "Old",
      createdAt: now,
    });
    const { user, bucket } = await ensureOwnerAndBucket();
    assert.equal(bucket.id, "b-old");
    assert.equal(user.id, "old-user-1");
    assert.equal(await kv.get(keys.owner()), "old-user-1");
  });

  it("throws when multiple buckets exist and no name is set", async () => {
    const now = Date.now();
    await bucketRepository.create({
      id: "b-1",
      name: "box",
      userId: "u-1",
      size: 0,
      count: 0,
      createdAt: now,
      updatedAt: now,
    });
    await bucketRepository.create({
      id: "b-2",
      name: "drive",
      userId: "u-2",
      size: 0,
      count: 0,
      createdAt: now,
      updatedAt: now,
    });
    await assert.rejects(
      ensureOwnerAndBucket(),
      (err: any) => err?.statusCode === 500 && /Multiple buckets/.test(String(err?.message ?? err))
    );
  });

  it("picks the bucket named by NUXT_BUCKET_NAME", async () => {
    const now = Date.now();
    await bucketRepository.create({
      id: "b-1",
      name: "box",
      userId: "u-1",
      size: 0,
      count: 0,
      createdAt: now,
      updatedAt: now,
    });
    await bucketRepository.create({
      id: "b-2",
      name: "drive",
      userId: "u-2",
      size: 0,
      count: 0,
      createdAt: now,
      updatedAt: now,
    });
    process.env.NUXT_BUCKET_NAME = "drive";
    const { bucket } = await ensureOwnerAndBucket();
    assert.equal(bucket.id, "b-2");
    assert.equal(bucket.userId, "u-2");
  });

  it("does not create a bucket when keys listing fails", async () => {
    setKvOverride(null);
    // restore override but break keys
    const broken = new MemoryKv();
    broken.keys = async () => {
      throw new Error("listing disabled");
    };
    setKvOverride(broken);
    await assert.rejects(ensureOwnerAndBucket(), /listing disabled/);
    // restore
    setKvOverride(kv);
  });
});
