import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  parsePasswordHash,
  passwordFingerprint,
  verifyPassword,
} from "./password";

describe("password", () => {
  it("hashes with pbkdf2$sha256 and verifies", async () => {
    const stored = await hashPassword("correct horse");
    const parsed = parsePasswordHash(stored);
    assert.ok(parsed);
    assert.equal(parsed.iterations, 100000);
    assert.equal(await verifyPassword("correct horse", stored), true);
    assert.equal(await verifyPassword("wrong", stored), false);
  });

  it("rejects missing or malformed hashes", async () => {
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", "not-a-hash"), false);
    assert.equal(await verifyPassword("x", "pbkdf2$sha256$abc$aa$bb"), false);
  });

  it("changes fingerprint when the stored hash changes", async () => {
    const a = await hashPassword("secret");
    const b = await hashPassword("secret");
    assert.notEqual(a, b);
    assert.notEqual(await passwordFingerprint(a), await passwordFingerprint(b));
    assert.equal(await passwordFingerprint(a), await passwordFingerprint(a));
  });
});
