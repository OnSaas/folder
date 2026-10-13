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
    assert.equal(shouldProtectApi("/dav"), false);
    assert.equal(shouldProtectApi("/public/files/a"), false);
  });

  it("rejects missing or stale session fingerprints", () => {
    assert.equal(sessionFingerprintValid(undefined, "abc"), false);
    assert.equal(sessionFingerprintValid("abc", ""), false);
    assert.equal(sessionFingerprintValid("abc", "def"), false);
    assert.equal(sessionFingerprintValid("abc", "abc"), true);
  });
});
