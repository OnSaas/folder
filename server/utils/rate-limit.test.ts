import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryKv } from "../storage/memory";
import { setKvOverride } from "../storage/kv";
import {
  AUTH_MAX_FAILURES,
  AUTH_WINDOW_MS,
  assertNotRateLimited,
  authFailKey,
  clearAuthFailures,
  clientIp,
  evaluateFailure,
  getAuthFailureState,
  recordAuthFailure,
} from "./rate-limit";

describe("rate limit", () => {
  const kv = new MemoryKv();
  setKvOverride(kv);

  beforeEach(() => {
    kv.store.clear();
  });

  it("is not limited at the start of a window", () => {
    const state = evaluateFailure(null, 1000);
    assert.equal(state.limited, false);
    assert.equal(state.count, 0);
  });

  it("limits after 5 failures in the window", async () => {
    const now = Date.now();
    let last = { limited: false, count: 0 };
    for (let i = 0; i < AUTH_MAX_FAILURES; i++) {
      last = await recordAuthFailure("web", "1.1.1.1", now);
    }
    assert.equal(last.count, AUTH_MAX_FAILURES);
    assert.equal(last.limited, true);
    const state = await getAuthFailureState("web", "1.1.1.1", now);
    assert.equal(state.limited, true);
  });

  it("resets after the window", async () => {
    await recordAuthFailure("web", "2.2.2.2", 0);
    const later = evaluateFailure({ count: 5, start: 0 }, AUTH_WINDOW_MS + 1);
    assert.equal(later.limited, false);
    assert.equal(later.expired, true);
  });

  it("clears failures on success", async () => {
    await recordAuthFailure("web", "3.3.3.3");
    await clearAuthFailures("web", "3.3.3.3");
    const state = await assertNotRateLimited("web", "3.3.3.3");
    assert.equal(state.count, 0);
    assert.equal(state.limited, false);
  });

  it("isolates web and dav scopes", async () => {
    for (let i = 0; i < AUTH_MAX_FAILURES; i++) {
      await recordAuthFailure("dav", "9.9.9.9");
    }
    const davState = await assertNotRateLimited("dav", "9.9.9.9");
    const webState = await assertNotRateLimited("web", "9.9.9.9");
    assert.equal(davState.limited, true);
    assert.equal(webState.limited, false);
    assert.equal(webState.count, 0);
    assert.ok(kv.store.has(authFailKey("dav", "9.9.9.9")));
    assert.equal(kv.store.has(authFailKey("web", "9.9.9.9")), false);
  });

  it("expires records with ttl", async () => {
    await recordAuthFailure("web", "4.4.4.4");
    assert.ok(kv.store.has(authFailKey("web", "4.4.4.4")));
    const originalNow = Date.now;
    Date.now = () => originalNow() + AUTH_WINDOW_MS + 1000;
    try {
      const state = await assertNotRateLimited("web", "4.4.4.4");
      assert.equal(state.count, 0);
      assert.equal(state.limited, false);
      assert.equal(kv.store.has(authFailKey("web", "4.4.4.4")), false);
    } finally {
      Date.now = originalNow;
    }
  });

  it("prefers cf-connecting-ip over spoofed x-forwarded-for", () => {
    const headers = new Headers();
    headers.set("cf-connecting-ip", "203.0.113.9");
    headers.set("x-forwarded-for", "198.51.100.1");
    const event = {
      headers,
      node: { req: { socket: { remoteAddress: "192.0.2.1" } } },
    };
    assert.equal(clientIp(event), "203.0.113.9");
  });
});
