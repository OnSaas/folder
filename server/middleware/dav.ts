import { handleDav } from "../utils/webdav";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  if (path !== "/dav" && !path.startsWith("/dav/")) return;
  return handleDav(event);
});
