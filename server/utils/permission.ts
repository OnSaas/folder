import { getBucket } from "./db";
import { tError } from "./i18n";

export const getVerifiedUser = async (event: any) => {
  const { user } = await requireUserSession(event);
  if (!user) {
    throw createError({
      status: 401,
      message: tError(event, "errors.unauthorized"),
    });
  }
  return user;
};

export const verifyBucket = async (event: any) => {
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
  if (bucket.userId !== user.id) {
    throw createError({
      status: 401,
      message: tError(event, "errors.unauthorized"),
    });
  }
  return { bucket, user };
};
