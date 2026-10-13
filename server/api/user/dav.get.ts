import { userRepository } from "~~/server/repositories/user";
import { tError } from "~~/server/utils/i18n";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  if (!user?.id) {
    throw createError({ status: 401, message: tError(event, "errors.unauthorized") });
  }
  const record = await userRepository.get(user.id);
  const password = record?.davPassword || "";
  return {
    enabled: Boolean(record?.davUsername && (password || record?.davPasswordHash)),
    path: "/dav",
    paths: ["/dav", "/webdav"],
    username: record?.davUsername || "",
    password,
  };
});
