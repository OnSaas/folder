import { sha256Hex } from "~~/server/utils/webdav";
import { userRepository } from "~~/server/repositories/user";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  if (!user?.id) {
    throw createError({ status: 401, message: "Unauthorized" });
  }
  const body = await readBody<{ password?: string }>(event);
  const password = (body?.password || "").trim();
  if (password.length < 8) {
    throw createError({ status: 400, message: "Password must be at least 8 characters" });
  }
  const hash = await sha256Hex(password);
  await userRepository.setDavPasswordHash(user.id, hash);
  return { status: "success" };
});
