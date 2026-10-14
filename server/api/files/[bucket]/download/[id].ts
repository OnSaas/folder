import { verifyBucket } from "~~/server/utils/permission";
import { getDriver } from "~~/server/storage/drivers";
import { serveObject } from "~~/server/storage/drivers/serve";

export default defineEventHandler(async (event) => {
  const { bucket } = await verifyBucket(event);
  const { id } = await getRouterParams(event);

  if (id) {
    const item = await getFolder(id);
    if (item && item.bucketName === bucket.name) {
      setHeader(event, "Cache-Control", "no-cache, no-store, must-revalidate");
      setHeader(event, "Pragma", "no-cache");
      setHeader(event, "Expires", "0");
      return serveObject(event, getDriver(item.storageId || "primary"), item.path, {
        downloadName: item.name,
      });
    }
  } else {
    throw createError({
      message: "Invalid request",
      status: 400,
    });
  }
});
