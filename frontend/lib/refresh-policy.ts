const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/verify-otp', '/auth/forgot-password', '/auth/reset-password', '/auth/refresh'];

export function shouldAttemptRefresh(status: number | undefined, url: string | undefined, retried: boolean): boolean {
  if (status !== 401 || retried) return false;
  return !AUTH_ENDPOINTS.some((endpoint) => url?.startsWith(endpoint));
}
