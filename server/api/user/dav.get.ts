import { userRepository } from "~~/server/repositories/user";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  if (!user?.id) {
    throw createError({ status: 401, message: "Unauthorized" });
  }
  const record = await userRepository.get(user.id);
  return { enabled: Boolean(record?.davPasswordHash), path: "/dav" };
});
