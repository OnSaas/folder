import { sha256Hex } from "~~/server/utils/webdav";
import { userRepository } from "~~/server/repositories/user";

const USERNAME = /^[a-zA-Z0-9._-]{3,32}$/;

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  if (!user?.id) {
    throw createError({ status: 401, message: "Unauthorized" });
  }
  const body = await readBody<{ username?: string; password?: string }>(event);
  const username = (body?.username || "").trim().toLowerCase();
  const password = (body?.password || "").trim();
  if (!USERNAME.test(username)) {
    throw createError({
      status: 400,
      message: "Username must be 3-32 characters: letters, numbers, . _ -",
    });
  }
  const record = await userRepository.get(user.id);
  if (!record) {
    throw createError({ status: 404, message: "User not found" });
  }
  const taken = await userRepository.getByDavUsername(username);
  if (taken && taken.id !== user.id) {
    throw createError({ status: 409, message: "Username already taken" });
  }
  let hash: string | undefined;
  if (password) {
    if (password.length < 8) {
      throw createError({ status: 400, message: "Password must be at least 8 characters" });
    }
    hash = await sha256Hex(password);
  } else if (!record.davPasswordHash) {
    throw createError({ status: 400, message: "Password must be at least 8 characters" });
  }
  await userRepository.setDavCredentials(user.id, username, hash);
  return { status: "success", username };
});
