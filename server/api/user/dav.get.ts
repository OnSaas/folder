import { userRepository } from "~~/server/repositories/user";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  if (!user?.id) {
    throw createError({ status: 401, message: "Unauthorized" });
  }
  const record = await userRepository.get(user.id);
  const password = record?.davPassword || "";
  return {
    enabled: Boolean(record?.davUsername && (password || record?.davPasswordHash)),
    path: "/dav",
    username: record?.davUsername || "",
    password,
  };
});
