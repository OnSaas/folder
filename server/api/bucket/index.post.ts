import { createBucket } from "~~/server/utils/db";
import { getVerifiedUser } from "~~/server/utils/permission";

export default defineEventHandler(async (event) => {
  const user = await getVerifiedUser(event);
  const { name } = await readBody(event);
  if (!name) {
    throw createError({
      message: "Bucket name is required",
      status: 400,
    });
  }
  if (name.length < 1 || name.length > 20) {
    throw createError({
      message: "Bucket name should be between 1 to 20 characters",
      status: 400,
    });
  }

  // @ts-ignore
  const hasBuckets = await getUserBucket(user.id);
  if (hasBuckets) {
    throw createError({
      message: "You already have a bucket",
      status: 400,
    });
  }
  // @ts-ignore
  return await createBucket(name, user.id);
});
