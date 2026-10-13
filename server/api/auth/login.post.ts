import { tError } from "~~/server/utils/i18n";
import {
  getAdminPasswordHash,
  passwordFingerprint,
  verifyPassword,
} from "~~/server/utils/password";
import {
  assertNotRateLimited,
  clearAuthFailures,
  clientIp,
  recordAuthFailure,
} from "~~/server/utils/rate-limit";
import { ensureOwnerAndBucket } from "~~/server/utils/owner";

export default defineEventHandler(async (event) => {
  const ip = clientIp(event);
  const limited = await assertNotRateLimited("web", ip);
  if (limited.limited) {
    throw createError({
      status: 429,
      message: tError(event, "errors.tooManyAttempts"),
    });
  }

  const stored = getAdminPasswordHash();
  if (!stored) {
    throw createError({
      status: 503,
      message: tError(event, "errors.passwordNotConfigured"),
    });
  }

  const body = await readBody<{ password?: string }>(event);
  const password = typeof body?.password === "string" ? body.password : "";
  const ok = password ? await verifyPassword(password, stored) : false;
  if (!ok) {
    const next = await recordAuthFailure("web", ip);
    if (next.limited) {
      throw createError({
        status: 429,
        message: tError(event, "errors.tooManyAttempts"),
      });
    }
    throw createError({
      status: 401,
      message: tError(event, "errors.invalidPassword"),
    });
  }

  await clearAuthFailures("web", ip);
  const { user } = await ensureOwnerAndBucket();
  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name || "Owner",
      locale: user.locale ?? null,
    },
    pwdFp: await passwordFingerprint(stored),
  });
  return { ok: true };
});
