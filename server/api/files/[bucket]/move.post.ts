export default defineEventHandler(async (event) => {
  const { bucket } = await verifyBucket(event);
  const body = await readBody(event);
  if (!body.file || !body.parentId) {
    throw createError({ status: 400, message: "Invalid Request" });
  }
  await ensureFile(bucket.name, body.file.id);
  return moveFile(bucket.name, body.file.id, body.parentId);
});
