import { delKey, getJson, setJson } from "../storage/kv";

export const AUTH_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_MAX_FAILURES = 5;

export function authFailKey(ip: string) {
  return `idx:auth:fail:${ip || "unknown"}`;
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

export async function getAuthFailureState(ip: string, now = Date.now()) {
  const rec = await getJson<FailureRecord>(authFailKey(ip));
  return evaluateFailure(rec, now);
}

export async function assertNotRateLimited(ip: string) {
  const state = await getAuthFailureState(ip);
  return state;
}

export async function recordAuthFailure(ip: string, now = Date.now()) {
  const current = await getAuthFailureState(ip, now);
  const next: FailureRecord = current.expired
    ? { count: 1, start: now }
    : { count: current.count + 1, start: current.start };
  await setJson(authFailKey(ip), next);
  return evaluateFailure(next, now);
}

export async function clearAuthFailures(ip: string) {
  await delKey(authFailKey(ip));
}

export function clientIp(event: any) {
  try {
    return (
      getRequestIP(event, { xForwardedFor: true }) ||
      getHeader(event, "cf-connecting-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}
