import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryKv } from "../storage/memory";
import { setKvOverride } from "../storage/kv";
import {
  AUTH_MAX_FAILURES,
  AUTH_WINDOW_MS,
  assertNotRateLimited,
  clearAuthFailures,
  evaluateFailure,
  getAuthFailureState,
  recordAuthFailure,
} from "./rate-limit";

describe("rate limit", () => {
  const kv = new MemoryKv();
  setKvOverride(kv);

  beforeEach(async () => {
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
      last = await recordAuthFailure("1.1.1.1", now);
    }
    assert.equal(last.count, AUTH_MAX_FAILURES);
    assert.equal(last.limited, true);
    const state = await getAuthFailureState("1.1.1.1", now);
    assert.equal(state.limited, true);
  });

  it("resets after the window", async () => {
    await recordAuthFailure("2.2.2.2", 0);
    const later = evaluateFailure({ count: 5, start: 0 }, AUTH_WINDOW_MS + 1);
    assert.equal(later.limited, false);
    assert.equal(later.expired, true);
  });

  it("clears failures on success", async () => {
    await recordAuthFailure("3.3.3.3");
    await clearAuthFailures("3.3.3.3");
    const state = await assertNotRateLimited("3.3.3.3");
    assert.equal(state.count, 0);
    assert.equal(state.limited, false);
  });
});
