import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryKv } from "./memory";
import { setKvOverride } from "./kv";
import { userRepository } from "../repositories/user";
import { bucketRepository } from "../repositories/bucket";
import { fileRepository } from "../repositories/file";
import { favoriteRepository } from "../repositories/favorite";
import { keys } from "./keys";
import { getList } from "./kv";

describe("kv repositories", () => {
  const kv = new MemoryKv();
  setKvOverride(kv);

  it("stores user without email index", async () => {
    const user = await userRepository.create({
      id: "u1",
      name: "Ada",
      status: "active",
      locale: "zh-CN",
      createdAt: Date.now(),
    });
    assert.equal(user.schemaVersion, 1);
    assert.equal(await kv.get(keys.userEmail("ada@example.com")), null);
    const updated = await userRepository.setLocale("u1", "en");
    assert.equal(updated?.locale, "en");
  });

  it("stores bucket indexes", async () => {
    const bucket = await bucketRepository.create({
      id: "b1",
      name: "drive-1",
      userId: "u1",
      size: 0,
      count: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    assert.equal((await bucketRepository.getByName("drive-1"))?.id, bucket.id);
    assert.equal((await bucketRepository.getByUser("u1"))?.id, bucket.id);
  });

  it("indexes folder children and path", async () => {
    const now = Date.now();
    const folder = await fileRepository.create({
      id: "f1",
      name: "Projects",
      contentType: "folder",
      type: "folder",
      size: 0,
      path: "drive-1/Projects",
      visibility: "private",
      count: 0,
      parentId: "root",
      bucketName: "drive-1",
      userId: "u1",
      sharedCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const file = await fileRepository.create({
      id: "file1",
      name: "resume.pdf",
      contentType: "application/pdf",
      type: "document",
      size: 10,
      path: "drive-1/Projects/resume.pdf",
      visibility: "inherit",
      count: 0,
      parentId: folder.id,
      bucketName: "drive-1",
      userId: "u1",
      sharedCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const children = await fileRepository.listChildren("drive-1", folder.id);
    assert.equal(children.length, 1);
    assert.equal(children[0].id, file.id);
    const byPath = await fileRepository.getByPath(
      "drive-1",
      "drive-1/Projects/resume.pdf"
    );
    assert.equal(byPath?.id, "file1");
    const root = await getList(keys.userRoot("u1"));
    assert.ok(root.includes("f1"));
  });

  it("soft-delete moves file to trash index", async () => {
    const file = await fileRepository.get("file1");
    assert.ok(file);
    await fileRepository.update({ ...file, deletedAt: Date.now() }, file);
    assert.equal(await fileRepository.getByPath("drive-1", file.path), null);
    const trash = await fileRepository.listTrash("u1");
    assert.equal(trash[0]?.id, "file1");
  });

  it("favorites", async () => {
    await favoriteRepository.add("u1", "file1");
    assert.equal(await favoriteRepository.has("u1", "file1"), true);
  });

  it("indexes custom dav username", async () => {
    await userRepository.setDavCredentials("u1", "ada.dav", "plain-pass");
    assert.equal((await userRepository.getByDavUsername("ADA.DAV"))?.id, "u1");
    await userRepository.setDavCredentials("u1", "ada2", "plain-pass-2");
    assert.equal(await userRepository.getByDavUsername("ada.dav"), null);
    assert.equal((await userRepository.getByDavUsername("ada2"))?.id, "u1");
  });
});
