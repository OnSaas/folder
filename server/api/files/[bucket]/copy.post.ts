export default defineEventHandler(async (event) => {
  const { bucket } = await verifyBucket(event);
  const body = await readBody(event);
  if (!body.file) {
    throw createError({ status: 400, message: "Invalid Request" });
  }
  await ensureFile(bucket.name, body.file.id);
  return copyFileItem(bucket.name, body.file.id, body.name);
});
