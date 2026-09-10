import { getBucket } from "./db";
import { tError } from "./i18n";

// @ts-ignore
export const getVerifiedUser = async (event) => {
  const { user } = await requireUserSession(event);
  if (!user) {
    throw createError({
      status: 401,
      message: tError(event, "errors.unauthorized"),
    });
  }
  return user;
};
// @ts-ignore
export const verifyBucket = async (event) => {
  const user = await getVerifiedUser(event);
  const params = getRouterParams(event);
  if (!params.bucket) {
    throw createError({
      status: 400,
      message: tError(event, "errors.invalidPath"),
    });
  }
  const bucket = await getBucket(params.bucket);
  if (!bucket) {
    throw createError({
      status: 404,
      message: tError(event, "errors.bucketNotFound"),
    });
  }
  // @ts-ignore
  if (bucket.userId !== user.id) {
    throw createError({
      status: 401,
      message: tError(event, "auth.unauthorized"),
    });
  }
  return { bucket, user };
};
