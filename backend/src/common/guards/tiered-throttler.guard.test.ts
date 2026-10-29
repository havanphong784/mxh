import assert from "node:assert/strict";
import { test } from "node:test";
import { TieredThrottlerGuard } from "./tiered-throttler.guard.js";

test("unverified bearer tokens share the caller IP rate limit", async () => {
  const guard = Object.create(TieredThrottlerGuard.prototype) as TieredThrottlerGuard;
  const tracker = (request: object) =>
    (guard as unknown as { getTracker(req: object): Promise<string> }).getTracker(request);

  const first = await tracker({ ip: "203.0.113.10", headers: { authorization: "Bearer fake-one" } });
  const second = await tracker({ ip: "203.0.113.10", headers: { authorization: "Bearer fake-two" } });
  assert.equal(first, "ip:203.0.113.10");
  assert.equal(second, first);
  assert.equal(await tracker({ ip: "203.0.113.10", user: { sub: "user-1" } }), "user:user-1");
});

test("a verified bearer token uses its signed user ID for rate limiting", async () => {
  const guard = Object.create(TieredThrottlerGuard.prototype) as TieredThrottlerGuard;
  (guard as unknown as { jwtService: object }).jwtService = {
    async verifyAsync(token: string) {
      if (token !== "valid-token") throw new Error("bad signature");
      return { sub: "user-42" };
    },
  };
  const tracker = (request: object) =>
    (guard as unknown as { getTracker(req: object): Promise<string> }).getTracker(request);

  assert.equal(await tracker({ ip: "203.0.113.10", headers: { authorization: "Bearer valid-token" } }), "user:user-42");
  assert.equal(await tracker({ ip: "203.0.113.10", headers: { authorization: "Bearer forged-token" } }), "ip:203.0.113.10");
});
