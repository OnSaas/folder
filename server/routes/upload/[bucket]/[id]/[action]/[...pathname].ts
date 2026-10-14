import { insertUpdateFile, updateContentType } from "~~/server/utils/db";
import { getContentType } from "~~/shared/utils/helper";
import { getDriver, R2Driver } from "~~/server/storage/drivers";

export default eventHandler(async (event) => {
  const { user } = await verifyBucket(event);
  // @ts-ignore
  const userId = user.id;
  const { bucket, id } = getRouterParams(event);

  // Get headers from the request to extract custom metadata
  const headers = event.headers;
  const dimensions = headers.get("x-amz-meta-dimensions") || null;
  const headerContentType = headers.get("x-amz-meta-content-type") || null;
  if (id !== "root") {
    const folder = await getFolder(id);
    if (!folder) {
      throw createError({
        status: 404,
        message: "Folder not found",
      });
    }
  }
  const driver = getDriver();
  if (!(driver instanceof R2Driver)) {
    throw createError({ status: 501, message: "Multipart upload requires R2" });
  }
  const response = await driver.handleMultipartUpload(event);
  if (response.action === "complete") {
    // Remove the prefix only from the start of the pathname
    let contentType =
      response.data.contentType ||
      headerContentType ||
      getContentType(response.data.pathname);
    contentType = contentType.toLowerCase().trim();
    // Basic validation (ensure it follows the pattern type/subtype)
    if (!contentType || !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(contentType)) {
      // Invalid content type format, fall back to a safe default based on extension
      contentType = getContentType(response.data.pathname);
    }
    const file = await insertUpdateFile(bucket, id, {
      ...response.data,
      fullPath: response.data.pathname,
      contentType,
      userId,
      dimensions,
    });
    if (file && file.id) {
      const metadata = await getDriver(file.storageId || "primary").head(file.path);
      if (
        metadata &&
        metadata.contentType &&
        metadata.contentType !== contentType &&
        metadata.contentType !== "application/octet-stream"
      ) {
        await updateContentType(file.id, metadata.contentType);
      }
    }
  }
  return response;
});
