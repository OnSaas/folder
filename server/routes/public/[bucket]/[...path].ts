import { isParentPublic } from "~~/server/utils/db";
import { getDriver } from "~~/server/storage/drivers";
import { serveObject } from "~~/server/storage/drivers/serve";

export default defineEventHandler(async (event) => {
  const params = getRouterParams(event);
  if (!params.path) {
    throw createError({
      status: 404,
      message: "Page not found",
    });
  }
  const fullPath = params.bucket + "/" + decodeURIComponent(params.path);
  const file = await getFile(params.bucket, fullPath);
  if (!file) {
    throw createError({
      status: 404,
      message: "Page not found",
    });
  }
  const driver = getDriver(file.storageId || "primary");
  if (file.visibility === "public") {
    return await serveObject(event, driver, `${params.bucket}/${params.path}`);
  }
  const isPublic = await isParentPublic(params.bucket, params.path);
  if (!isPublic) {
    throw createError({
      status: 404,
      message: "Page not found",
    });
  }
  if (file.type === "folder") {
    const indexFile = await getFile(params.bucket, `${params.path}/index.html`);
    if (indexFile) {
      return await serveObject(
        event,
        getDriver(indexFile.storageId || "primary"),
        `${params.bucket}/${params.path}/index.html`
      );
    }
  } else {
    return await serveObject(event, driver, `${params.bucket}/${params.path}`);
  }
});
