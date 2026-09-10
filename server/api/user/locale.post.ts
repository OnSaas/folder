import { userRepository } from "~~/server/repositories/user";
import type { LocaleCode } from "~~/server/storage/types";

const allowed: LocaleCode[] = ["en", "zh-CN"];

export default defineEventHandler(async (event) => {
  const user = await getVerifiedUser(event);
  const body = await readBody(event);
  const locale = body?.locale as LocaleCode;
  if (!allowed.includes(locale)) {
    throw createError({ status: 400, message: "Invalid locale" });
  }
  const updated = await userRepository.setLocale(user.id, locale);
  if (!updated) {
    throw createError({ status: 404, message: "User not found" });
  }
  await setUserSession(event, {
    user: {
      ...user,
      locale,
    },
  });
  return { status: "success", locale };
});
