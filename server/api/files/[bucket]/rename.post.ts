export default defineEventHandler(async (event) => {
  const { bucket } = await verifyBucket(event);
  const body = await readBody(event);
  if (!body.file || !body.name) {
    throw createError({ status: 400, message: "Invalid Request" });
  }
  await ensureFile(bucket.name, body.file.id);
  const result = await renameFile(bucket.name, body.file.id, body.name);
  return { status: result.success ? "success" : "error" };
});
