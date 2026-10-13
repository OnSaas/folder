import { tError } from "../utils/i18n";
import { shouldProtectApi, sessionFingerprintValid } from "../utils/api-guard";
import { getAdminPasswordHash, passwordFingerprint } from "../utils/password";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!shouldProtectApi(path)) return;

  const stored = getAdminPasswordHash();
  const expected = stored ? await passwordFingerprint(stored) : "";
  try {
    const session = await requireUserSession(event);
    if (!sessionFingerprintValid(session.pwdFp as string | undefined, expected)) {
      await clearUserSession(event);
      throw createError({
        status: 401,
        message: tError(event, "errors.unauthorized"),
      });
    }
  } catch (err: any) {
    if (err?.statusCode) throw err;
    throw createError({
      status: 401,
      message: tError(event, "errors.unauthorized"),
    });
  }
});
