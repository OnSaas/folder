import { getUserBucket } from "~~/server/utils/db";
import { getVerifiedUser } from "~~/server/utils/permission";
import { ensureOwnerAndBucket } from "~~/server/utils/owner";

export default defineEventHandler(async (event) => {
  const user = await getVerifiedUser(event);
  await ensureOwnerAndBucket();
  return await getUserBucket(user.id);
});
