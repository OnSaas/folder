import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOpenApiPath,
  shouldProtectApi,
  sessionFingerprintValid,
} from "./api-guard";

describe("api guard", () => {
  it("leaves login open and protects other api paths", () => {
    assert.equal(isOpenApiPath("/api/auth/login"), true);
    assert.equal(shouldProtectApi("/api/auth/login"), false);
    assert.equal(shouldProtectApi("/api/auth/logout"), true);
    assert.equal(shouldProtectApi("/api/bucket"), true);
    assert.equal(shouldProtectApi("/api/storages"), true);
    assert.equal(shouldProtectApi("/api/mounts/b2/list"), true);
    assert.equal(shouldProtectApi("/preview/files/a.png"), true);
    assert.equal(shouldProtectApi("/upload/files/x/y/z"), true);
    assert.equal(shouldProtectApi("/public/files/a.html"), false);
    assert.equal(shouldProtectApi("/dav"), false);
    assert.equal(shouldProtectApi("/dav/files/a"), false);
    assert.equal(shouldProtectApi("/webdav"), false);
  });

  it("rejects missing or stale session fingerprints", () => {
    assert.equal(sessionFingerprintValid(undefined, "abc"), false);
    assert.equal(sessionFingerprintValid("abc", ""), false);
    assert.equal(sessionFingerprintValid("abc", "def"), false);
    assert.equal(sessionFingerprintValid("abc", "abc"), true);
  });
});
