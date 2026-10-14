import { getDriver } from "~~/server/storage/drivers";

export default defineEventHandler(async (event) => {
  const { user } = await verifyBucket(event);
  // @ts-ignore
  const userId = user.id;
  const params = getRouterParams(event);
  const { name, type } = await readBody(event);
  if (!name) {
    throw createError({
      message: `${type} name is required`,
      status: 400,
    });
  }
  const parent = await getParent(params.bucket, params.id);
  const fullPath = cleanPath(`${parent.path}/${name}`);
  // does file exist?
  const file = await getFile(params.bucket, fullPath);
  if (file) {
    throw createError({
      message: `${type} already exists`,
      status: 400,
    });
  }
  if (type === "file") {
    const fileName = fullPath.split("/").pop();
    if (!fileName) {
      throw createError({
        message: "Invalid file name",
        status: 400,
      });
    }
    const splitName = fileName.split(".");
    // If there's no extension (no dot or the dot is at the beginning)
    if (splitName.length < 2) {
      throw createError({
        message: "Invalid file extension",
        status: 400,
      });
    }
    const ext = splitName.pop() as keyof typeof validTextFiles;
    // Now check if it's a valid extension
    if (!Object.keys(validTextFiles).includes(ext)) {
      throw createError({
        message: `Invalid file extension. Supported extensions are ${Object.keys(
          validTextFiles
        ).join(", ")}`,
        status: 400,
      });
    }
    const contentType = validTextFiles[ext];
    const emptyFile = new Blob([""], { type: contentType });
    await getDriver().put(fullPath, await emptyFile.arrayBuffer(), {
      contentType,
      size: 0,
    });
    return insertUpdateFile(params.bucket, parent.id, {
      name: fileName,
      fullPath,
      contentType: contentType,
      size: 0,
      userId,
    });
  } else {
    return await ensurePath(params.bucket, fullPath, userId);
  }
});
