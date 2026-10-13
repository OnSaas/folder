export function isOpenApiPath(path: string) {
  return path === "/api/auth/login" || path.startsWith("/api/auth/login/");
}

export function shouldProtectApi(path: string) {
  return path.startsWith("/api/") && !isOpenApiPath(path);
}

export function sessionFingerprintValid(
  sessionFp: string | undefined,
  expectedFp: string
) {
  if (!expectedFp || !sessionFp) return false;
  return sessionFp === expectedFp;
}
