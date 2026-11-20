export type Area = "social" | "people" | "inbox" | "auth" | "missing";
type Route = { area: Area; path: string; private: boolean };
const auth = new Set([
  "/login",
  "/register",
  "/verify-otp",
  "/forgot-password",
  "/reset-password",
]);
const social = new Set([
  "/",
  "/explore",
  "/search",
  "/bookmarks",
  "/likes",
  "/compose",
]);
export function resolveRoute(input: string): Route {
  const url = new URL(input, "http://mxh.local");
  const p = url.pathname.replace(/\/$/, "") || "/";
  const path = `${p}${url.search}`;
  if (p === "/liked")
    return { area: "social", path: `/likes${url.search}`, private: true };
  if (p === "/settings/security")
    return { area: "people", path: `/settings${url.search}`, private: true };
  if (auth.has(p)) return { area: "auth", path, private: false };
  if (
    p === "/settings" ||
    p === "/people" ||
    /^\/profile\/[^/]+(?:\/(?:followers|following))?$/.test(p)
  )
    return { area: "people", path, private: p === "/settings" };
  if (p === "/notifications" || /^\/messages(?:\/[^/]+)?$/.test(p))
    return { area: "inbox", path, private: true };
  if (p === "/home" || p === "/feed")
    return { area: "social", path: `/${url.search}`, private: true };
  if (social.has(p) || /^\/posts?\/[^/]+$/.test(p))
    return {
      area: "social",
      path: path.replace(/^\/post\//, "/posts/"),
      private: ["/", "/bookmarks", "/likes", "/compose"].includes(p),
    };
  if (/^\/[a-zA-Z0-9_]{3,30}(?:\/(?:followers|following))?$/.test(p))
    return { area: "people", path: `/profile${path}`, private: false };
  return { area: "missing", path, private: false };
}

export function safeReturn(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000- ]/.test(value)
  )
    return "/";
  const route = resolveRoute(value);
  return route.area === "auth" || route.area === "missing" ? "/" : route.path;
}
