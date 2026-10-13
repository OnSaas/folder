import { delKey, getJson, setJson } from "../storage/kv";

export const AUTH_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_MAX_FAILURES = 5;

export type AuthScope = "web" | "dav";

export function authFailKey(scope: AuthScope, ip: string) {
  return `idx:auth:fail:${scope}:${ip || "unknown"}`;
}

export type FailureRecord = {
  count: number;
  start: number;
};

export function evaluateFailure(
  rec: FailureRecord | null,
  now = Date.now()
): { count: number; start: number; limited: boolean; expired: boolean } {
  if (!rec) {
    return { count: 0, start: now, limited: false, expired: true };
  }
  if (now - rec.start > AUTH_WINDOW_MS) {
    return { count: 0, start: now, limited: false, expired: true };
  }
  return {
    count: rec.count,
    start: rec.start,
    limited: rec.count >= AUTH_MAX_FAILURES,
    expired: false,
  };
}

export async function getAuthFailureState(
  scope: AuthScope,
  ip: string,
  now = Date.now()
) {
  const rec = await getJson<FailureRecord>(authFailKey(scope, ip));
  return evaluateFailure(rec, now);
}

export async function assertNotRateLimited(scope: AuthScope, ip: string) {
  return getAuthFailureState(scope, ip);
}

export async function recordAuthFailure(
  scope: AuthScope,
  ip: string,
  now = Date.now()
) {
  const current = await getAuthFailureState(scope, ip, now);
  const next: FailureRecord = current.expired
    ? { count: 1, start: now }
    : { count: current.count + 1, start: current.start };
  await setJson(
    authFailKey(scope, ip),
    next,
    Math.ceil(AUTH_WINDOW_MS / 1000)
  );
  return evaluateFailure(next, now);
}

export async function clearAuthFailures(scope: AuthScope, ip: string) {
  await delKey(authFailKey(scope, ip));
}

export function clientIp(event: any) {
  try {
    const headers = event?.headers;
    const get =
      headers?.get?.bind(headers) ??
      ((name: string) => headers?.[name] ?? headers?.[name.toLowerCase()]);
    return (
      get?.("cf-connecting-ip") ||
      get?.("CF-Connecting-IP") ||
      getRequestIP(event) ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}
