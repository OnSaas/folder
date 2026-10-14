import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MemoryKv } from "../storage/memory";
import { setKvOverride } from "../storage/kv";
import { hashPassword, passwordFingerprint } from "./password";
import { AUTH_MAX_FAILURES } from "./rate-limit";

// Minimal Nitro / nuxt-auth-utils stubs so the real handlers can run in Node.
function installGlobals() {
  const g = globalThis as any;
  g.defineEventHandler = (fn: any) => fn;
  g.createError = (opts: any) => {
    const err: any = new Error(opts?.message || "error");
    err.statusCode = opts?.status;
    err.status = opts?.status;
    return err;
  };
  g.readBody = async (event: any) => event._body;
  g.getRequestURL = (event: any) =>
    new URL("http://localhost" + (event.path || "/"));
  g.getRequestIP = () => undefined;
  g.getCookie = () => undefined;
  g.setUserSession = async (event: any, data: any) => {
    event._session = data;
  };
  g.requireUserSession = async (event: any) => {
    if (!event._session) {
      const err: any = new Error("unauthorized");
      err.statusCode = 401;
      throw err;
    }
    return event._session;
  };
  g.clearUserSession = async (event: any) => {
    event._session = undefined;
  };
}

installGlobals();

const loginHandler = (await import("~~/server/api/auth/login.post")).default;
const authMiddleware = (await import("~~/server/middleware/01-auth")).default;

// One shared KV override for every suite: calling setKvOverride again in a
// second describe would replace the global override and leave the first
// suite's beforeEach clearing an instance nothing reads from.
const kv = new MemoryKv();
setKvOverride(kv);

function makeEvent(overrides: Record<string, unknown> = {}) {
  const headers = new Headers();
  headers.set("cf-connecting-ip", "203.0.113.5");
  return { headers, path: "/api/bucket", _body: undefined, ...overrides } as any;
}

async function resetAuthState() {
  kv.store.clear();
  delete process.env.NUXT_ADMIN_PASSWORD_HASH;
  process.env.NUXT_BUCKET_NAME = "files";
  return hashPassword("correct horse battery");
}

describe("login handler", () => {
  let stored: string;

  beforeEach(async () => {
    stored = await resetAuthState();
  });

  it("fails closed when no password hash is configured", async () => {
    await assert.rejects(
      loginHandler(makeEvent({ _body: { password: "correct horse battery" } })),
      (err: any) => err.statusCode === 503
    );
  });

  it("rejects a wrong password with 401", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    await assert.rejects(
      loginHandler(makeEvent({ _body: { password: "nope" } })),
      (err: any) => err.statusCode === 401
    );
  });

  it("rejects an empty password with 401", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    await assert.rejects(
      loginHandler(makeEvent({ _body: {} })),
      (err: any) => err.statusCode === 401
    );
  });

  it("locks out after the failure limit", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    let lastCode = 0;
    for (let i = 0; i < AUTH_MAX_FAILURES; i++) {
      try {
        await loginHandler(makeEvent({ _body: { password: "nope" } }));
      } catch (err: any) {
        lastCode = err.statusCode;
      }
    }
    assert.equal(lastCode, 429);
  });

  it("accepts the correct password and stores a session fingerprint", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    const event = makeEvent({ _body: { password: "correct horse battery" } });
    const res = await loginHandler(event);
    assert.equal(res.ok, true);
    assert.equal(await event._session.pwdFp, await passwordFingerprint(stored));
    assert.equal(event._session.user.id, "owner");
  });
});

describe("auth middleware", () => {
  let stored: string;

  beforeEach(async () => {
    stored = await resetAuthState();
  });

  it("leaves public and WebDAV paths untouched", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    await authMiddleware(makeEvent({ path: "/public/files/a.html" }));
    await authMiddleware(makeEvent({ path: "/dav/files/a" }));
    await authMiddleware(makeEvent({ path: "/webdav/files/a" }));
  });

  it("rejects /api without a session", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    await assert.rejects(
      authMiddleware(makeEvent({ path: "/api/bucket" })),
      (err: any) => err.statusCode === 401
    );
  });

  it("rejects a stale fingerprint and clears the session", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    const event = makeEvent({
      path: "/api/bucket",
      _session: { user: { id: "owner" }, pwdFp: "stale" },
    });
    await assert.rejects(
      authMiddleware(event),
      (err: any) => err.statusCode === 401
    );
    assert.equal(event._session, undefined);
  });

  it("accepts a session whose fingerprint matches the current hash", async () => {
    process.env.NUXT_ADMIN_PASSWORD_HASH = stored;
    const event = makeEvent({
      path: "/preview/files/a.png",
      _session: {
        user: { id: "owner" },
        pwdFp: await passwordFingerprint(stored),
      },
    });
    await authMiddleware(event);
    assert.ok(event._session);
  });
});
