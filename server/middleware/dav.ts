import { handleDav, isDavPath } from "../utils/webdav";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (!isDavPath(path)) return;
  return handleDav(event);
});
